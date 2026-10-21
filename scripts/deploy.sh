#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh: uploads AOTD to the server, builds it there and restarts the
# push server.
#
# Usage:
#   ./scripts/deploy.sh               # upload changed files, build on the server, restart
#   ./scripts/deploy.sh --check       # run lint, typecheck and unit tests locally first
#   ./scripts/deploy.sh --full        # upload every file, ignoring the change check
#   ./scripts/deploy.sh --web-only    # build the site but skip COMMAND (push server)
#   ./scripts/deploy.sh --clean       # drop old hashed assets instead of keeping them
#   ./scripts/deploy.sh --diagnose    # only print the push server state on the server (no deploy)
#
# Steps:
#   1. Loads credentials from scripts/.env (same format as the Akaread scripts)
#   2. Uploads the project over SFTP, skipping unchanged files and removing on the
#      server the files deleted locally from the code folders
#   3. On the server: npm install and a build into a temporary folder, which then
#      replaces dist/ in one move, so the site never serves a half built folder.
#      Old hashed assets are copied over, so tabs opened before the deploy keep working
#   4. Runs COMMAND from scripts/.env (default: npm install in server/ and a pm2
#      reload of the push server, or pm2 start on the first deploy)
#   5. Waits until the site and the push API answer again
#
# Requires: python 3.8+ with paramiko (installed automatically), curl
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[deploy]${NC} $*"; }
success() { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()    { echo -e "${YELLOW}[deploy]${NC} $*"; }
die()     { echo -e "${RED}[deploy] ERROR:${NC} $*" >&2; exit 1; }

FULL_UPLOAD=false
RUN_CHECKS=false
WEB_ONLY=false
CLEAN_ASSETS=false
DIAGNOSE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --full) FULL_UPLOAD=true ;;
    --check) RUN_CHECKS=true ;;
    --web-only) WEB_ONLY=true ;;
    --clean) CLEAN_ASSETS=true ;;
    --diagnose) DIAGNOSE=true ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
  shift
done

START_TIME=$(date +%s)

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

[[ -f "$ENV_FILE" ]] || die "scripts/.env not found (copy scripts/.env.example and fill it in)"
[[ -f "$ROOT_DIR/package.json" ]] || die "package.json not found at $ROOT_DIR"
command -v curl &>/dev/null || die "curl is required"
[[ -f "$ROOT_DIR/.env" ]] || warn ".env not found: the server keeps its current .env (VITE_SENTRY_DSN)"

# ── Python + paramiko ────────────────────────────────────────────────────────
PYTHON=""
for candidate in python python3 py; do
  if command -v "$candidate" &>/dev/null && "$candidate" -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" &>/dev/null; then
    PYTHON="$candidate"; break
  fi
done
[[ -n "$PYTHON" ]] || die "python 3.8+ is required"

if ! "$PYTHON" -c "import paramiko" &>/dev/null; then
  info "Installing paramiko..."
  "$PYTHON" -m pip install paramiko --quiet || die "Failed to install paramiko. Run manually: pip install paramiko"
  "$PYTHON" -c "import paramiko" &>/dev/null || die "paramiko still not importable after install"
fi

# Git Bash paths (/c/foo) become Windows paths (C:/foo) for Python
to_py_path() {
  if [[ "$1" =~ ^/([a-zA-Z])/(.*)$ ]]; then echo "${BASH_REMATCH[1]^^}:/${BASH_REMATCH[2]}"; else echo "$1"; fi
}

# ── Optional local checks ────────────────────────────────────────────────────
if [[ "$RUN_CHECKS" == true ]]; then
  command -v npm &>/dev/null || die "npm is required for --check"
  cd "$ROOT_DIR"
  [[ -d node_modules ]] || npm ci --no-audit --no-fund
  info "Running lint, typecheck and unit tests..."
  npm run lint
  npm run typecheck
  npm test
  success "  Checks passed"
fi

# Everything is passed to Python through the environment, so passwords with
# quotes or dollar signs are never interpolated into code
export DEPLOY_ENV_FILE="$(to_py_path "$ENV_FILE")"
export DEPLOY_ROOT_DIR="$(to_py_path "$ROOT_DIR")"
export DEPLOY_FULL_UPLOAD="$FULL_UPLOAD"
export DEPLOY_WEB_ONLY="$WEB_ONLY"
export DEPLOY_CLEAN_ASSETS="$CLEAN_ASSETS"
export DEPLOY_DIAGNOSE="$DIAGNOSE"
export DEPLOY_VERSION="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
export PYTHONIOENCODING="utf-8"
export PYTHONUNBUFFERED="1"

# ── Deploy ────────────────────────────────────────────────────────────────────
"$PYTHON" - <<'PYEOF'
import os
import posixpath
import re
import shlex
import socket
import stat
import sys
import time
import urllib.error
import urllib.request

import paramiko

CYAN, GREEN, YELLOW, RED, NC = "\033[0;36m", "\033[0;32m", "\033[1;33m", "\033[0;31m", "\033[0m"

def info(msg): print(f"{CYAN}[deploy]{NC} {msg}", flush=True)
def success(msg): print(f"{GREEN}[deploy]{NC} {msg}", flush=True)
def warn(msg): print(f"{YELLOW}[deploy]{NC} {msg}", flush=True)
def die(msg):
    print(f"{RED}[deploy] ERROR:{NC} {msg}", file=sys.stderr, flush=True)
    sys.exit(1)

# ── Config from scripts/.env ────────────────────────────────────────────────
def load_env(path):
    values = {}
    with open(path, encoding="utf-8-sig") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            match = re.match(r'^(?:export\s+)?(\w+)\s*=\s*(.*)$', line)
            if not match:
                continue
            key, value = match.group(1), match.group(2).strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            else:
                value = re.sub(r"\s+#.*$", "", value)
            values[key] = value
    return values

env = load_env(os.environ["DEPLOY_ENV_FILE"])
for key in ("WEB_HOST", "WEB_USER", "WEB_PATH"):
    if not env.get(key):
        die(f"{key} not found in scripts/.env")
if not env.get("WEB_PASSWORD") and not env.get("WEB_KEY_PATH"):
    die("Set WEB_PASSWORD or WEB_KEY_PATH in scripts/.env")

HOST = env["WEB_HOST"]
PORT = int(env.get("WEB_PORT") or 22)
USER = env["WEB_USER"]
PASSWORD = env.get("WEB_PASSWORD") or None
KEY_PATH = os.path.expanduser(env["WEB_KEY_PATH"]) if env.get("WEB_KEY_PATH") else None
REMOTE_ROOT = env["WEB_PATH"].rstrip("/") or "/"
PM2_NAME = env.get("PM2_NAME") or "aotd"
SITE_URL = (env.get("SITE_URL") or "https://aotd.eduardoalves.tech").rstrip("/")
# Runs after the build, from the project root on the server
DEFAULT_COMMAND = (
    "cd server && "
    "npm install --omit=dev --no-audit --no-fund && "
    # creates server/.env with VAPID keys on the first deploy, never changes it later
    "npm run setup-env && "
    # delete + start (not reload) so pm2 also picks up a new Node interpreter
    f"(pm2 delete {PM2_NAME} >/dev/null 2>&1 || true) && "
    "pm2 start ecosystem.config.cjs && "
    "pm2 save"
)
COMMAND = env.get("COMMAND") or DEFAULT_COMMAND
# Node major version used to build on the server (Vite 8 needs 20.19 or newer)
NODE_VERSION = env.get("NODE_VERSION") or "22"

LOCAL_ROOT = os.environ["DEPLOY_ROOT_DIR"]
FULL_UPLOAD = os.environ.get("DEPLOY_FULL_UPLOAD") == "true"
WEB_ONLY = os.environ.get("DEPLOY_WEB_ONLY") == "true"
CLEAN_ASSETS = os.environ.get("DEPLOY_CLEAN_ASSETS") == "true"
VERSION = os.environ.get("DEPLOY_VERSION") or "unknown"
DIAGNOSE = os.environ.get("DEPLOY_DIAGNOSE") == "true"

# Never uploaded, at any depth: WEB_IGNORED_FOLDER plus the build output, which is made on the server
DEFAULT_IGNORED = "node_modules,.history,.git,.vscode,design,coverage,playwright-report,test-results,_to_delete"
IGNORED_NAMES = {
    item.strip() for item in (env.get("WEB_IGNORED_FOLDER") or DEFAULT_IGNORED).split(",") if item.strip()
} | {"dist", ".dist-next", ".dist-old", ".DS_Store"}
# Never uploaded, by path: secrets and data that only exist on the server
IGNORED_PATHS = {"scripts/.env", "server/.env", "server/data"}
# Code folders mirror the local copy exactly: files deleted locally are removed remotely
PRUNE_DIRS = {"src", "public", "e2e", "deploy", "scripts", "server/src", "server/test"}

success(f"Config loaded: {USER}@{HOST}:{REMOTE_ROOT} (version {VERSION})")

# ── SSH / SFTP connection with reconnects ──────────────────────────────────
ssh = None
sftp = None

def connect():
    global ssh, sftp
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        HOST,
        port=PORT,
        username=USER,
        password=PASSWORD,
        key_filename=KEY_PATH,
        look_for_keys=False,
        allow_agent=False,
        timeout=30,
        banner_timeout=30,
        auth_timeout=30,
    )
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(15)
    sftp = ssh.open_sftp()

def reconnect():
    for attempt in range(1, 6):
        try:
            if sftp:
                sftp.close()
            if ssh:
                ssh.close()
        except Exception:
            pass
        try:
            connect()
            warn(f"  SFTP reconnected (attempt {attempt})")
            return
        except Exception as exc:
            warn(f"  SFTP reconnect failed ({attempt}/5): {exc}")
            if attempt == 5:
                raise
            time.sleep(min(attempt * 2, 10))

def retry(action, description, attempts=4):
    for attempt in range(1, attempts + 1):
        try:
            return action()
        except (IOError, OSError, EOFError, socket.error, paramiko.SSHException) as exc:
            if isinstance(exc, FileNotFoundError):
                raise
            warn(f"  {description} interrupted ({attempt}/{attempts}): {exc}")
            if attempt == attempts:
                raise
            reconnect()

try:
    connect()
except Exception as exc:
    die(f"Could not connect to {HOST}: {exc}")

# ── --diagnose: read only report of the push server ─────────────────────────
# Prints only key names from server/.env, never their values.
if DIAGNOSE:
    name = shlex.quote(PM2_NAME)
    report = (
        f"cd {shlex.quote(REMOTE_ROOT)} || exit 1; "
        "echo '== Node'; echo \"system: $(command -v node) $(node -v 2>/dev/null)\"; "
        "ls \"${NVM_DIR:-$HOME/.nvm}/versions/node\" 2>/dev/null | sed 's/^/nvm: /'; "
        "echo '== server/.env (keys only)'; "
        "if [ -f server/.env ]; then sed -E 's/=.*/=***/' server/.env | grep -v '^#' | grep .; else echo 'MISSING'; fi; "
        "PORT=$(grep -E '^PORT=' server/.env 2>/dev/null | head -1 | cut -d= -f2 | tr -d '\"\\'\\'' '); "
        "PORT=${PORT:-7115}; echo \"PORT used by the app: $PORT\"; "
        f"echo '== pm2 {PM2_NAME}'; "
        f"pm2 describe {name} 2>&1 | grep -E 'status|restarts|interpreter|node.js version|script path|exec cwd|error log' || echo 'not in pm2'; "
        f"echo '== Last log lines'; pm2 logs {name} --lines 40 --nostream --raw 2>&1 | tail -50; "
        "echo '== Listening on the port'; (ss -ltnp 2>/dev/null | grep -E \":$PORT\\b\") || echo \"nothing listens on $PORT\"; "
        "echo '== API from the server itself'; "
        "curl -s -m 5 -o /dev/null -w 'http://127.0.0.1:'$PORT'/api/push/public-key -> %{http_code}\\n' http://127.0.0.1:$PORT/api/push/public-key; "
        "echo '== Vhost'; grep -hnE 'proxy_pass|^[[:space:]]*root ' /etc/nginx/sites-enabled/*aotd* 2>/dev/null || echo 'vhost file not readable'"
    )
    info(f"Diagnosing the push server on {HOST}")
    _, stdout, _ = ssh.exec_command(f"bash -lc {shlex.quote(report)}", get_pty=True)
    for line in iter(stdout.readline, ""):
        print(f"  {line}", end="", flush=True)
    ssh.close()
    sys.exit(0)

# ── Step 1: upload ─────────────────────────────────────────────────────────
info("Step 1/4: uploading the project" + (" (every file, --full)" if FULL_UPLOAD else " (only changed files)"))

stats = {"uploaded": 0, "skipped": 0, "removed": 0, "bytes": 0}

def remote_listing(remote_dir):
    try:
        return {entry.filename: entry for entry in retry(lambda: sftp.listdir_attr(remote_dir), f"listing {remote_dir}")}
    except FileNotFoundError:
        retry(lambda: sftp.mkdir(remote_dir), f"creating {remote_dir}")
        return {}

def needs_upload(local_path, remote_entry):
    if FULL_UPLOAD or remote_entry is None or stat.S_ISDIR(remote_entry.st_mode or 0):
        return True
    local_stat = os.stat(local_path)
    return local_stat.st_size != remote_entry.st_size or int(local_stat.st_mtime) != int(remote_entry.st_mtime or 0)

def upload_file(local_path, remote_path):
    local_stat = os.stat(local_path)
    def action():
        sftp.put(local_path, remote_path, confirm=False)
        # Remote mtime mirrors the local one, so the next deploy can skip this file
        sftp.utime(remote_path, (int(local_stat.st_atime), int(local_stat.st_mtime)))
    retry(action, f"upload {remote_path}")
    stats["uploaded"] += 1
    stats["bytes"] += local_stat.st_size
    print(f"  upload {remote_path}", flush=True)

def remove_remote(remote_path, entry):
    if stat.S_ISDIR(entry.st_mode or 0):
        for child in retry(lambda: sftp.listdir_attr(remote_path), f"listing {remote_path}"):
            remove_remote(posixpath.join(remote_path, child.filename), child)
        retry(lambda: sftp.rmdir(remote_path), f"removing {remote_path}")
    else:
        retry(lambda: sftp.remove(remote_path), f"removing {remote_path}")
    stats["removed"] += 1
    print(f"  {YELLOW}remove{NC} {remote_path}", flush=True)

def is_ignored(relative_path, name):
    return name in IGNORED_NAMES or relative_path in IGNORED_PATHS

def sync_dir(local_dir, remote_dir, relative_dir, prune):
    remote_entries = remote_listing(remote_dir)
    local_names = set()
    for name in sorted(os.listdir(local_dir)):
        relative_path = f"{relative_dir}/{name}" if relative_dir else name
        if is_ignored(relative_path, name):
            continue
        local_path = os.path.join(local_dir, name)
        remote_path = posixpath.join(remote_dir, name)
        if os.path.islink(local_path):
            continue
        local_names.add(name)
        if os.path.isdir(local_path):
            sync_dir(local_path, remote_path, relative_path, prune or relative_path in PRUNE_DIRS)
        elif needs_upload(local_path, remote_entries.get(name)):
            upload_file(local_path, remote_path)
        else:
            stats["skipped"] += 1
    if prune:
        for name, entry in remote_entries.items():
            relative_path = f"{relative_dir}/{name}" if relative_dir else name
            if name not in local_names and not is_ignored(relative_path, name):
                remove_remote(posixpath.join(remote_dir, name), entry)

sync_dir(LOCAL_ROOT, REMOTE_ROOT, "", False)
success(f"  {stats['uploaded']} uploaded ({stats['bytes'] / 1_048_576:.1f} MB), {stats['skipped']} unchanged, {stats['removed']} removed")

def run_remote(command):
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)
    # A login shell loads the same PATH (node, npm, pm2) as an interactive session
    _, stdout, _ = ssh.exec_command(f"bash -lc {shlex.quote(command)}", get_pty=True)
    for line in iter(stdout.readline, ""):
        print(f"  {line}", end="", flush=True)
    return stdout.channel.recv_exit_status()

def run_step(command, failure):
    try:
        exit_code = run_remote(command)
    except (paramiko.SSHException, socket.error, EOFError) as exc:
        die(f"Connection lost on the server: {exc}")
    if exit_code != 0:
        die(f"{failure} (exit code {exit_code}). Check the output above.")

root = shlex.quote(REMOTE_ROOT)

# Loads a recent Node.js before each remote step. The system node on the server
# can be older than the build tools need (Ubuntu ships Node 18), so this uses nvm:
# it installs nvm and NODE_VERSION once when they are missing, then reuses them.
node_version = shlex.quote(NODE_VERSION)
node_setup = (
    'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; '
    'if [ ! -s "$NVM_DIR/nvm.sh" ]; then '
    "echo 'nvm not found, installing it (one time)'; "
    "curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | PROFILE=/dev/null bash >/dev/null || exit 3; "
    "fi; "
    '. "$NVM_DIR/nvm.sh" || exit 3; '
    f"if ! nvm use --silent {node_version} >/dev/null 2>&1; then "
    f"echo 'Installing Node.js {NODE_VERSION} with nvm (one time)'; "
    f"nvm install {node_version} >/dev/null && nvm use --silent {node_version} >/dev/null || exit 3; "
    "fi; "
    "node -e \"const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>20||(a===20&&b>=19)?0:1)\" "
    "|| { echo \"Node $(node -v) is too old: set NODE_VERSION in scripts/.env to 22 or newer\"; exit 3; }; "
)

# ── Step 2: build on the server ────────────────────────────────────────────
# The build goes to .dist-next and only replaces dist/ when it succeeded, so a
# failed build leaves the live site untouched.
info("Step 2/4: installing dependencies and building on the server")
keep_assets = "" if CLEAN_ASSETS else (
    "if [ -d dist/assets ]; then mkdir -p .dist-next/assets && (cp -rn dist/assets/. .dist-next/assets/ 2>/dev/null || true); fi && "
)
build_command = (
    f"{node_setup}"
    "echo \"Using Node $(node -v)\" && "
    f"cd {root} && "
    "npm install --no-audit --no-fund && "
    "rm -rf .dist-next && "
    f"VITE_APP_VERSION={shlex.quote(VERSION)} npx vite build --outDir .dist-next --emptyOutDir && "
    f"{keep_assets}"
    "rm -rf .dist-old && "
    "if [ -d dist ]; then mv dist .dist-old; fi && "
    "mv .dist-next dist && "
    "rm -rf .dist-old"
)
run_step(build_command, "Server build failed, the live site was not changed")
success("  Build finished and published to dist/")

# ── Step 3: COMMAND ────────────────────────────────────────────────────────
if WEB_ONLY:
    warn("Step 3/4: COMMAND skipped (--web-only)")
else:
    info(f"Step 3/4: running COMMAND ({'push server restart' if COMMAND == DEFAULT_COMMAND else COMMAND})")
    run_step(f"{node_setup}cd {root} && {COMMAND}", "COMMAND failed, the site itself is already live")
    success("  COMMAND finished")

try:
    sftp.close()
    ssh.close()
except Exception:
    pass

# ── Step 4: health check ───────────────────────────────────────────────────
def wait_for(url, label, expect_json=False, seconds=60):
    deadline = time.time() + seconds
    last_error = ""
    while time.time() < deadline:
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "aotd-deploy"})
            with urllib.request.urlopen(request, timeout=10) as response:
                body = response.read(512).decode("utf-8", "replace")
                if 200 <= response.status < 400 and (not expect_json or body.lstrip().startswith("{")):
                    success(f"  {label} answered {response.status}")
                    return True
                last_error = f"HTTP {response.status}"
        except urllib.error.HTTPError as exc:
            last_error = f"HTTP {exc.code}"
        except Exception as exc:
            last_error = str(exc)
        time.sleep(3)
    warn(f"  {label} did not answer within {seconds} s ({last_error})")
    return False

def fetch_text(url):
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "aotd-deploy", "Cache-Control": "no-cache"})
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, response.read(200_000).decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return exc.code, ""
    except Exception:
        return None, ""

# The vhost must serve dist/ only. When its root is the project folder, the
# site breaks (the browser gets src/index.jsx) and private files become public.
def check_vhost():
    _, home = fetch_text(SITE_URL + "/")
    problems = []
    if "/src/index.jsx" in home:
        problems.append("the home page is the source index.html, not the build")
    for path in ("/scripts/.env", "/package.json", "/.git/config", "/server/src/index.js"):
        status, body = fetch_text(SITE_URL + path)
        # A 200 with the app's own index.html is just the SPA fallback, which is fine.
        if status == 200 and body and body != home:
            problems.append(f"{path} is publicly downloadable")
    if not problems:
        success("  Vhost serves dist/ only")
        return True
    for problem in problems:
        print(f"{RED}  ✗ {problem}{NC}", flush=True)
    print(
        f"{RED}  The vhost root must be {REMOTE_ROOT}/dist (see deploy/nginx-aotd.conf). "
        f"If scripts/.env was exposed, change the server password now.{NC}",
        flush=True,
    )
    return False

info(f"Step 4/4: checking {SITE_URL}")
wait_for(SITE_URL, "Site")
vhost_ok = check_vhost()
if not WEB_ONLY:
    info("  Waiting for the push API (up to 20 s)")
    if not wait_for(f"{SITE_URL}/api/push/public-key", "Push API", expect_json=True, seconds=20):
        warn(f"  Check the vhost /api/push/ block and: pm2 logs {PM2_NAME}")
        warn("  Check that COMMAND in scripts/.env recreates the push server (see scripts/.env.example)")
if not vhost_ok:
    sys.exit(1)
PYEOF

ELAPSED=$(( $(date +%s) - START_TIME ))
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  AOTD deploy finished in $((ELAPSED / 60))m $((ELAPSED % 60))s${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

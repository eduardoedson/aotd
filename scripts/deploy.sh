#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh: uploads AOTD to the server, builds it there and restarts the
# push server.
#
# Usage:
#   ./scripts/deploy.sh               # upload changed files, build on the server, restart
#   ./scripts/deploy.sh --check       # run lint, typecheck and unit tests locally first
#   ./scripts/deploy.sh --full        # upload every file, ignoring the change check
#   ./scripts/deploy.sh --web-only    # build the site but leave the push server alone
#   ./scripts/deploy.sh --clean       # drop old hashed assets instead of keeping them
#
# Steps:
#   1. Loads credentials from scripts/.env
#   2. Uploads the project over SFTP, skipping unchanged files and removing on the
#      server the files deleted locally from the code folders
#   3. On the server: npm install and a build into a temporary folder, which then
#      replaces dist/ in one move, so the site never serves a half built folder.
#      Old hashed assets are copied over, so tabs opened before the deploy keep working
#   4. Push server: npm install and pm2 reload (pm2 start on the first deploy)
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
while [[ $# -gt 0 ]]; do
  case "$1" in
    --full) FULL_UPLOAD=true ;;
    --check) RUN_CHECKS=true ;;
    --web-only) WEB_ONLY=true ;;
    --clean) CLEAN_ASSETS=true ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
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
for key in ("DEPLOY_HOST", "DEPLOY_USER", "DEPLOY_PATH"):
    if not env.get(key):
        die(f"{key} not found in scripts/.env")
if not env.get("DEPLOY_PASSWORD") and not env.get("DEPLOY_KEY_PATH"):
    die("Set DEPLOY_KEY_PATH (recommended) or DEPLOY_PASSWORD in scripts/.env")

HOST = env["DEPLOY_HOST"]
PORT = int(env.get("DEPLOY_PORT") or 22)
USER = env["DEPLOY_USER"]
PASSWORD = env.get("DEPLOY_PASSWORD") or None
KEY_PATH = os.path.expanduser(env["DEPLOY_KEY_PATH"]) if env.get("DEPLOY_KEY_PATH") else None
KEY_PASSPHRASE = env.get("DEPLOY_KEY_PASSPHRASE") or None
REMOTE_ROOT = env["DEPLOY_PATH"].rstrip("/") or "/"
PM2_NAME = env.get("PM2_NAME") or "aotd-push"
SITE_URL = (env.get("SITE_URL") or "https://aotd.eduardoalves.tech").rstrip("/")

LOCAL_ROOT = os.environ["DEPLOY_ROOT_DIR"]
FULL_UPLOAD = os.environ.get("DEPLOY_FULL_UPLOAD") == "true"
WEB_ONLY = os.environ.get("DEPLOY_WEB_ONLY") == "true"
CLEAN_ASSETS = os.environ.get("DEPLOY_CLEAN_ASSETS") == "true"
VERSION = os.environ.get("DEPLOY_VERSION") or "unknown"

# Never uploaded, at any depth: dependencies, build output, tooling and local data
IGNORED_NAMES = {
    "node_modules", "dist", ".dist-next", ".dist-old", ".git", ".history", ".vscode",
    "design", "coverage", "playwright-report", "test-results", "_to_delete", ".DS_Store",
}
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
        passphrase=KEY_PASSPHRASE,
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

# ── Step 2: build on the server ────────────────────────────────────────────
# The build goes to .dist-next and only replaces dist/ when it succeeded, so a
# failed build leaves the live site untouched.
info("Step 2/4: installing dependencies and building on the server")
keep_assets = "" if CLEAN_ASSETS else (
    "if [ -d dist/assets ]; then mkdir -p .dist-next/assets && (cp -rn dist/assets/. .dist-next/assets/ 2>/dev/null || true); fi && "
)
build_command = (
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

# ── Step 3: push server ────────────────────────────────────────────────────
if WEB_ONLY:
    warn("Step 3/4: push server skipped (--web-only)")
else:
    info(f"Step 3/4: restarting the push server ({PM2_NAME})")
    push_command = (
        f"cd {root}/server && "
        "if [ ! -f .env ]; then echo 'server/.env is missing: create it from .env.example first'; exit 2; fi && "
        "npm install --omit=dev --no-audit --no-fund && "
        f"(pm2 describe {shlex.quote(PM2_NAME)} >/dev/null 2>&1 "
        "&& pm2 reload ecosystem.config.cjs --update-env "
        "|| pm2 start ecosystem.config.cjs) && "
        "pm2 save"
    )
    run_step(push_command, "Push server restart failed, the site itself is already live")
    success(f"  pm2 process {PM2_NAME} is running")

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

info(f"Step 4/4: checking {SITE_URL}")
wait_for(SITE_URL, "Site")
if not WEB_ONLY:
    if not wait_for(f"{SITE_URL}/api/push/public-key", "Push API", expect_json=True):
        warn(f"  Check the vhost /api/push/ block and: pm2 logs {PM2_NAME}")
PYEOF

ELAPSED=$(( $(date +%s) - START_TIME ))
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  AOTD deploy finished in $((ELAPSED / 60))m $((ELAPSED % 60))s${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

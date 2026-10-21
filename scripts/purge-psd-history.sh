#!/usr/bin/env bash
# Removes the old PSD files from the whole Git history to shrink the repository.
#
# WARNING: this rewrites history. Every commit hash changes, the remote must be
# force pushed and every other clone must be cloned again. Run it only when you
# are sure, from a clean working tree.
#
# Requirements: git-filter-repo (pip install git-filter-repo)
set -euo pipefail

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "git-filter-repo is not installed. Run: pip install git-filter-repo" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or stash your changes first." >&2
  exit 1
fi

remote_url="$(git remote get-url origin)"
backup="../aotd-backup-$(date +%Y%m%d%H%M%S).bundle"

echo "Creating a full backup in $backup"
git bundle create "$backup" --all

echo "Size before:"
git count-objects -vH | grep size-pack

git filter-repo --force --invert-paths --path-glob '*.psd'

# filter-repo removes the remote on purpose, so a push cannot happen by accident.
git remote add origin "$remote_url"

echo "Size after:"
git count-objects -vH | grep size-pack

echo
echo "Done locally. To publish the rewritten history run:"
echo "  git push --force-with-lease origin main"

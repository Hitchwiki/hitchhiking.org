#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)

if [[ $# -ne 1 || -z $1 ]]; then
  echo "usage: $0 DESTINATION" >&2
  exit 2
fi

destination=$1
if [[ -e $destination ]]; then
  echo "error: destination already exists: $destination" >&2
  exit 1
fi

mkdir -p -- "$destination"
destination=$(cd -- "$destination" && pwd -P)

case "$destination/" in
  "$project_root/"*)
    echo "error: destination must be outside the project tree" >&2
    rmdir -- "$destination"
    exit 1
    ;;
esac

tar -C "$project_root" \
  --exclude='./.git' \
  --exclude='./.codex' \
  --exclude='./.env' \
  --exclude='./.env.*' \
  --exclude='./.venv' \
  --exclude='./coverage' \
  --exclude='./dist' \
  --exclude='./node_modules' \
  --exclude='./release' \
  --exclude='*.tar.gz' \
  -cf - . | tar -C "$destination" -xf -

"$project_root/scripts/check-release.sh" --release "$destination"
echo "Release snapshot created at $destination"

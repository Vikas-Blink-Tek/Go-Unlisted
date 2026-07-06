#!/usr/bin/env bash
# Source repo-root .env.local when present (gitignored).
_gu_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$_gu_root/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$_gu_root/.env.local"
  set +a
fi
unset _gu_root

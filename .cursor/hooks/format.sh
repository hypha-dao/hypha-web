#!/bin/bash
# afterFileEdit hook — runs format:fix from package.json for consistency
# Receives JSON via stdin with { "file_path": "<absolute path>", ... }

set -euo pipefail

input=$(cat)
file_path=$(node -e 'try{const d=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(d.file_path||"")}catch{}' <<< "$input")

if [ -z "$file_path" ] || [ ! -f "$file_path" ]; then
  exit 0
fi

# Only run format when editing files covered by format:fix (apps/**/*.{ts,tsx}, packages/**/*.{ts,tsx})
case "$file_path" in
  *"/apps/"*.ts|*"/apps/"*.tsx|*"/packages/"*.ts|*"/packages/"*.tsx)
    if ! pnpm exec prettier --write "$file_path" >/dev/null 2>&1; then
      echo "format hook: prettier failed for $file_path" >&2
    fi
    ;;
esac

exit 0

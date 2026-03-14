#!/bin/bash
# afterFileEdit hook — runs format:fix from package.json for consistency
# Receives JSON via stdin with { "file_path": "<absolute path>", ... }

set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | grep -o '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*:.*"\(.*\)"/\1/')

if [ -z "$file_path" ] || [ ! -f "$file_path" ]; then
  exit 0
fi

# Only run format when editing files covered by format:fix (apps/**/*.{ts,tsx}, packages/**/*.{ts,tsx})
case "$file_path" in
  *"/apps/"*.ts|*"/apps/"*.tsx|*"/packages/"*.ts|*"/packages/"*.tsx)
    pnpm run format:fix 2>/dev/null || true
    ;;
esac

exit 0

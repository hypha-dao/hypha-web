#!/usr/bin/env bash
# Copy .env files and .vercel config from a sibling worktree to the current one.
# Usage: ./scripts/copy-env.sh [source-worktree]
#
# If no argument is given, lists available worktrees and prompts for selection.

set -euo pipefail

CURRENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Get all worktrees except the bare repo
mapfile -t WORKTREES < <(git worktree list --porcelain | grep '^worktree ' | sed 's/^worktree //' | grep -v '\.bare$')

# Remove current worktree from the list
OTHER_WORKTREES=()
for wt in "${WORKTREES[@]}"; do
  [[ "$wt" != "$CURRENT_DIR" ]] && OTHER_WORKTREES+=("$wt")
done

if [[ ${#OTHER_WORKTREES[@]} -eq 0 ]]; then
  echo "❌ No other worktrees found."
  exit 1
fi

if [[ -n "${1:-}" ]]; then
  SOURCE="$1"
  # Allow passing just the branch/folder name (e.g. "ai-chat")
  if [[ ! -d "$SOURCE" ]]; then
    # Try resolving as a sibling worktree name
    for wt in "${OTHER_WORKTREES[@]}"; do
      if [[ "$wt" == *"/$1" || "$wt" == *"/$1/"* ]]; then
        SOURCE="$wt"
        break
      fi
    done
  fi
  if [[ ! -d "$SOURCE" ]]; then
    echo "❌ Source worktree not found: $1"
    echo "Available worktrees:"
    printf "  %s\n" "${OTHER_WORKTREES[@]}"
    exit 1
  fi
else
  echo "Available worktrees:"
  for i in "${!OTHER_WORKTREES[@]}"; do
    echo "  [$((i + 1))] ${OTHER_WORKTREES[$i]}"
  done
  read -rp "Select source worktree [1-${#OTHER_WORKTREES[@]}]: " choice
  if [[ -z "$choice" || ! "$choice" =~ ^[0-9]+$ || "$choice" -lt 1 || "$choice" -gt ${#OTHER_WORKTREES[@]} ]]; then
    echo "❌ Invalid selection."
    exit 1
  fi
  SOURCE="${OTHER_WORKTREES[$((choice - 1))]}"
fi

echo "📂 Source: $SOURCE"
echo "📂 Target: $CURRENT_DIR"
echo ""

COUNT=0
while IFS= read -r -d '' file; do
  rel="${file#"$SOURCE"/}"
  basename="$(basename "$rel")"

  # Skip .env.template and .env.example files
  [[ "$basename" == .env.template || "$basename" == .env.example ]] && continue

  target="$CURRENT_DIR/$rel"
  mkdir -p "$(dirname "$target")"
  cp "$file" "$target"
  echo "  ✅ $rel"
  COUNT=$((COUNT + 1))
done < <(find "$SOURCE" -name ".env*" -not -path "*/node_modules/*" -not -path "*/.git/*" -type f -print0)

if [[ $COUNT -eq 0 ]]; then
  echo "⚠️  No .env files found in source worktree."
else
  echo ""
  echo "✅ Copied $COUNT .env file(s)."
fi

# Copy .vercel directories
VERCEL_COUNT=0
while IFS= read -r -d '' dir; do
  rel="${dir#"$SOURCE"/}"
  target="$CURRENT_DIR/$rel"
  mkdir -p "$(dirname "$target")"
  cp -r "$dir" "$target"
  echo "  ✅ $rel/"
  VERCEL_COUNT=$((VERCEL_COUNT + 1))
done < <(find "$SOURCE" -name ".vercel" -not -path "*/node_modules/*" -not -path "*/.git/*" -type d -print0)

if [[ $VERCEL_COUNT -eq 0 ]]; then
  echo "⚠️  No .vercel directories found in source worktree."
else
  echo ""
  echo "✅ Copied $VERCEL_COUNT .vercel director(y/ies)."
fi

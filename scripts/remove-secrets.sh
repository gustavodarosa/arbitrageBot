#!/usr/bin/env bash
set -euo pipefail
echo "Removing secrets/ folder from git index and adding to .gitignore..."

git rm -r --cached secrets || true
if ! grep -qxF "secrets/" .gitignore; then
  echo "secrets/" >> .gitignore
fi
git add .gitignore
git commit -m "chore: remove secrets folder from repo and add to .gitignore" || true

echo "Now run (recommended) BFG to purge from history, see instructions in scripts/purge-history-instructions.txt"

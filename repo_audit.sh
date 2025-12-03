#!/usr/bin/env bash
set -euo pipefail

echo "=== REPO QUICK AUDIT $(date -u) ==="
echo

# Basic info
echo "[info] pwd: $(pwd)"
echo "[info] git branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo no-git)"
echo "[info] last commits (10):"
git --no-pager log -n 10 --oneline || true
echo

# Find likely secret files / suspicious names
echo "[scan] searching for likely secret filenames..."
git ls-files | grep -Ei "secret|secrets|key|private|pem|p12|.env" || true
echo

# Grep for common keywords in repo (naive)
echo "[scan] grep for suspicious tokens in tracked files (PRIVATE_KEY, API_KEY, SECRET, mnemonic)"
git grep -I --line-number -E "PRIVATE_KEY|PRIVATE_KEYS|API_KEY|SECRET|mnemonic|PASSWORD" || true
echo

# Show .env.example (if present)
echo "=== .env.example (if exists) ==="
if [ -f .env.example ]; then
  sed -n '1,200p' .env.example
else
  echo "(no .env.example)"
fi
echo

# Show package.json (first 300 lines)
echo "=== package.json ==="
if [ -f package.json ]; then
  sed -n '1,300p' package.json
else
  echo "(no package.json)"
fi
echo

# Node / npm versions
echo "[info] node:"
node -v 2>/dev/null || echo "node not installed"
echo "[info] npm:"
npm -v 2>/dev/null || echo "npm not installed"
echo

# Install deps (ci preferred)
echo "[action] running npm ci (may take a while)..."
if command -v npm >/dev/null 2>&1; then
  npm ci --silent || { echo "npm ci failed (ignore if you prefer)"; }
fi
echo

# Typecheck / build
echo "[action] TypeScript build check (tsc) if configured..."
if [ -f tsconfig.json ]; then
  npx -y tsc --noEmit || echo "tsc errors or not configured"
else
  echo "no tsconfig.json"
fi
echo

# NPM audit
echo "[action] running npm audit --json (output to audit.json)..."
if command -v npm >/dev/null 2>&1; then
  npm audit --json > audit.json || true
  echo "audit.json written (first 100 chars):"
  head -c 100 audit.json | sed -e 's/$/\n...[truncated]/'
else
  echo "npm not available"
fi
echo

# List key source files and show heads
echo "=== Key source files preview (first 200 lines each) ==="
for f in package.json src/index.ts src/arbitrage/*.ts src/utils/*.ts .env.example README.md; do
  if [ -f "$f" ]; then
    echo
    echo "----- $f -----"
    sed -n '1,200p' "$f"
  fi
done

# Summarize disk usage
echo
echo "[info] repo size (du -sh .):"
du -sh . || true

echo
echo "=== END OF AUDIT ==="

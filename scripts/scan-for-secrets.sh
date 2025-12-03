#!/usr/bin/env bash
set -euo pipefail
echo "Scanning repo for likely secrets (API_KEY, PRIVATE_KEY, SECRET)..."
git grep -I --line-number -E "PRIVATE_KEY|PRIVATE_KEYS|API_KEY|SECRET|password|mnemonic|seed" || echo "no matches found by naive grep"

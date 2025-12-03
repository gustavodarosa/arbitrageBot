CI / Security Actions

If repository history contained secrets, rotate them immediately:

- Rotate API keys, deployment keys, wallets, and any credentials that may have been leaked.
- Enable GitHub secret scanning and Dependabot alerts in repository settings.
- Notify collaborators and require them to re-clone the repo if history is rewritten.

Recommended steps after removing `secrets/` from repository:

1. Run `scripts/remove-secrets.sh` locally and commit the change.
2. Use BFG to purge secrets from history (see `scripts/purge-history-instructions.txt`).
3. Force-push the cleaned mirror if you used BFG; inform collaborators to re-clone.
4. Update any CI to use GitHub Secrets, not files in the repo.

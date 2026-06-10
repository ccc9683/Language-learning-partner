# LLP Agent Instructions

## Release Workflow

- When the user says “发布”, “推送”, or “来人”, use the repo-level Codex skill at `.agents/skills/llp-release/SKILL.md`.
- The release command is `scripts/release.sh`.
- Do not ask the user to paste GitHub passwords, tokens, API keys, or SSH private keys into Codex.
- Do not read, print, copy, or commit `.env`, API keys, GitHub tokens, or SSH private keys.
- If `git push` prompts for credentials, let the user enter them in their own CLI terminal.

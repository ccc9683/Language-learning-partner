# LLP Agent Instructions

## Release Workflow

- When the user says “发布”, “推送”, “来人”, “来人啊”, or “来啊”, use the repo-level Codex skill at `.agents/skills/llp-release/SKILL.md`.
- Default to two-step release:
  1. Codex runs `scripts/release.sh --local`.
  2. The user runs `scripts/release.sh --finish` in their own WSL terminal.
- Do not run `scripts/release.sh --finish` or `scripts/release.sh --full` by default.
- Only attempt `scripts/release.sh --full` if the user explicitly says “我确认让 Codex 直接 push/tag”.
- Do not ask the user to paste GitHub passwords, tokens, API keys, or SSH private keys into Codex.
- Do not read, print, copy, or commit `.env`, API keys, GitHub tokens, or SSH private keys.
- Do not read SSH private keys.
- Do not print tokens.
- Do not write tokens into git remote URLs, scripts, config files, or commit messages.
- If `git push` prompts for credentials, let the user enter them in their own CLI terminal.

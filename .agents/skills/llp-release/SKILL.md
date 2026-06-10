---
name: llp-release
description: Use when the user asks to publish, release, push, deploy, or uses Chinese trigger words like “发布”, “推送”, or “来人” for the LLP project. Runs the guarded LLP release workflow in /home/titie/projects/LLP: build frontend, test backend, commit changes, push main, create the next annotated version tag, and push the tag.
---

# LLP Release

Use this skill only for the LLP repository at `/home/titie/projects/LLP`.

## Triggers

Use this skill when the user asks:
- “发布”
- “推送”
- “来人”
- “release”
- “publish”
- “push”

## Workflow

Run:

```bash
/home/titie/projects/LLP/scripts/release.sh
```

The script performs the release sequence:
1. Checks `git remote -v`
2. Builds frontend with `pnpm build`
3. Runs backend tests with `pytest`
4. Shows `git status --short`
5. Stages relevant repository changes
6. Creates a generated commit if there are staged changes
7. Pushes `main`
8. Computes the next patch version tag
9. Creates an annotated tag
10. Pushes the tag
11. Prints final log, tags, and status

## Safety

- Do not ask the user to paste GitHub passwords, tokens, API keys, or SSH private keys into Codex.
- Do not read, print, copy, or commit `.env`, API keys, GitHub tokens, or SSH private keys.
- Do not write tokens into git remotes, scripts, config files, or commits.
- If `git push` prompts for credentials, let the user enter them in their own terminal. Do not capture or echo credentials.
- If credentials cannot be entered through the Codex execution environment, ask the user to run `scripts/release.sh` in a normal terminal.

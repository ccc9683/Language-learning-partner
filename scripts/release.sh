#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/home/titie/projects/LLP"
cd "$PROJECT_ROOT"

echo "== Git remotes =="
git remote -v

echo
echo "== Frontend build =="
cd "$PROJECT_ROOT/frontend"
pnpm build

echo
echo "== Backend tests =="
cd "$PROJECT_ROOT/backend"
source .venv/bin/activate
pytest

cd "$PROJECT_ROOT"

echo
echo "== Git status before staging =="
git status --short

echo
echo "== Staging changes =="
git add -A

if git diff --cached --quiet; then
  echo "No staged changes. Skipping commit."
else
  changed_files="$(git diff --cached --name-only)"
  commit_message="$(python3 - "$changed_files" <<'PY'
import sys

files = sys.argv[1].splitlines()
has_frontend = any(path.startswith("frontend/") for path in files)
has_backend = any(path.startswith("backend/") for path in files)
has_release = any(
    path.startswith(".agents/") or path.startswith("scripts/") or path == "AGENTS.md"
    for path in files
)

if has_release and not has_frontend and not has_backend:
    print("chore: update release workflow")
elif has_frontend and has_backend:
    print("feat: update LLP app")
elif has_frontend:
    print("feat: update frontend")
elif has_backend:
    print("feat: update backend")
else:
    print("chore: update repository")
PY
)"

  echo "Committing: $commit_message"
  git commit -m "$commit_message"
fi

echo
echo "== Push main =="
echo "If git prompts for Username/Password, enter credentials in the terminal. Do not paste secrets into Codex."
git push origin main

echo
echo "== Existing tags =="
git tag --sort=v:refname

latest_tag="$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -n 1)"
if [[ -z "$latest_tag" ]]; then
  latest_tag="$(git tag --list '[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -n 1)"
fi

if [[ -z "$latest_tag" ]]; then
  next_tag="v0.1.0"
else
  version="${latest_tag#v}"
  IFS='.' read -r major minor patch <<< "$version"
  next_tag="v${major}.${minor}.$((patch + 1))"
fi

while git rev-parse -q --verify "refs/tags/$next_tag" >/dev/null; do
  version="${next_tag#v}"
  IFS='.' read -r major minor patch <<< "$version"
  next_tag="v${major}.${minor}.$((patch + 1))"
done

echo
echo "== Create annotated tag: $next_tag =="
git tag -a "$next_tag" -m "Release $next_tag"

echo
echo "== Push tag =="
git push origin "$next_tag"

echo
echo "== Recent log =="
git log --oneline --decorate -5

echo
echo "== Tags =="
git tag --sort=v:refname

echo
echo "== Final status =="
git status --short

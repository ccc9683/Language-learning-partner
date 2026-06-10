#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/home/titie/projects/LLP"

usage() {
  cat <<'EOF'
Usage:
  scripts/release.sh --local   # build, test, commit locally; no push, no tag
  scripts/release.sh --finish  # require clean tree, push main, create and push next tag
  scripts/release.sh --full    # build, test, commit, push main, create and push next tag
EOF
}

show_remotes() {
  echo "== Git remotes =="
  git remote -v
}

run_frontend_build() {
  echo
  echo "== Frontend build =="
  cd "$PROJECT_ROOT/frontend"
  pnpm build
}

run_backend_tests() {
  echo
  echo "== Backend tests =="
  cd "$PROJECT_ROOT/backend"
  source .venv/bin/activate
  pytest
}

show_status() {
  echo
  echo "== Git status =="
  cd "$PROJECT_ROOT"
  git status --short
}

commit_if_needed() {
  cd "$PROJECT_ROOT"

  echo
  echo "== Staging changes =="
  git add -A

  if git diff --cached --quiet; then
    echo "No staged changes. Skipping commit."
    return
  fi

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
}

ensure_clean_worktree() {
  cd "$PROJECT_ROOT"

  if [[ -n "$(git status --short)" ]]; then
    echo "Working tree is not clean. Stop before push/tag."
    git status --short
    exit 1
  fi
}

next_version_tag() {
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

  echo "$next_tag"
}

finish_release() {
  cd "$PROJECT_ROOT"

  show_status
  ensure_clean_worktree

  echo
  echo "== Push main =="
  echo "If git prompts for Username/Password, enter credentials in the terminal. Do not paste secrets into Codex."
  git push origin main

  echo
  echo "== Existing tags =="
  git tag --sort=v:refname

  next_tag="$(next_version_tag)"

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

  show_status
}

local_release() {
  cd "$PROJECT_ROOT"

  show_remotes
  run_frontend_build
  run_backend_tests
  show_status
  commit_if_needed

  echo
  echo "== Local release checks complete =="
  echo "No push or tag was performed."
  echo
  echo "Run this in your WSL terminal to finish:"
  echo "cd /home/titie/projects/LLP"
  echo "scripts/release.sh --finish"
}

full_release() {
  cd "$PROJECT_ROOT"

  show_remotes
  run_frontend_build
  run_backend_tests
  show_status
  commit_if_needed
  finish_release
}

main() {
  mode="${1:-}"

  cd "$PROJECT_ROOT"

  case "$mode" in
    --local)
      local_release
      ;;
    --finish)
      finish_release
      ;;
    --full)
      full_release
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"

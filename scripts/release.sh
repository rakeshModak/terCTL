#!/usr/bin/env bash
#
# One-command release for TerCTL.
#
#   npm run release            # 1.0.2 -> 1.0.3  (patch)
#   npm run release:minor      # 1.0.2 -> 1.1.0
#   npm run release:major      # 1.0.2 -> 2.0.0
#
#   MSG="feat: terminal search" npm run release   # custom commit message
#   SKIP_BUILD=1 npm run release                  # skip the pre-release build
#
# It commits any pending work, bumps the version in package.json (tauri.conf.json
# reads from it), creates the vX.Y.Z tag, and pushes branch + tag. The tag push
# triggers the GitHub Actions release build, which auto-publishes when all three
# OS runners finish.
set -euo pipefail

BUMP="${1:-patch}"

# Load Node 22 (the Vite/Tauri toolchain lives under fnm).
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
  fnm use 22 >/dev/null 2>&1 || true
fi

# Must be on a real branch, not a detached HEAD.
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" ]]; then
  echo "✖ Detached HEAD — check out a branch first." >&2
  exit 1
fi

# 0) Make sure it compiles before we tag a release (SKIP_BUILD=1 to skip).
if [[ "${SKIP_BUILD:-}" != "1" ]]; then
  echo "• Building (set SKIP_BUILD=1 to skip)…"
  npm run build
  echo "✔ Build OK"
fi

# 1) Commit any pending work.
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "${MSG:-chore: updates for release}"
  echo "✔ Committed pending changes"
else
  echo "• Working tree clean — nothing to commit"
fi

# 2) Bump version in package.json and create the vX.Y.Z commit + tag.
NEW_TAG="$(npm version "$BUMP" -m "release: v%s")"
echo "✔ Bumped to $NEW_TAG"

# 3) Push branch + tag. The tag push starts the CI release build.
git push --follow-tags
echo "🚀 Pushed $BRANCH + $NEW_TAG — CI is building the release now."
echo "   Watch: https://github.com/rakeshModak/terCTL/actions"

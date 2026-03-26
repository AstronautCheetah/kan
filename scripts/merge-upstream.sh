#!/usr/bin/env bash
#
# merge-upstream.sh
#
# Reports on the merge-ability of upstream/main into the current branch.
# Does NOT actually merge -- this is a dry-run / reporting tool only.
#

set -euo pipefail

UPSTREAM_URL="https://github.com/kanbn/kan.git"
UPSTREAM_BRANCH="main"

echo "=== Upstream Merge Check ==="
echo ""

# 1. Ensure we are inside a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: Not inside a git repository."
  exit 1
fi

# 2. Add upstream remote if not already present
if git remote get-url upstream >/dev/null 2>&1; then
  echo "Upstream remote already configured: $(git remote get-url upstream)"
else
  echo "Adding upstream remote: $UPSTREAM_URL"
  git remote add upstream "$UPSTREAM_URL"
fi
echo ""

# 3. Fetch upstream
echo "Fetching upstream/$UPSTREAM_BRANCH..."
git fetch upstream "$UPSTREAM_BRANCH"
echo ""

# 4. Show new commits
COMMIT_COUNT=$(git rev-list "HEAD..upstream/$UPSTREAM_BRANCH" --count)
echo "--- New upstream commits: $COMMIT_COUNT ---"
if [ "$COMMIT_COUNT" -eq 0 ]; then
  echo "Already up to date with upstream/$UPSTREAM_BRANCH. Nothing to do."
  exit 0
fi
echo ""
git log "HEAD..upstream/$UPSTREAM_BRANCH" --oneline
echo ""

# 5. Show diffstat summary
echo "--- Diffstat ---"
git diff --stat "HEAD...upstream/$UPSTREAM_BRANCH"
echo ""

# 6. Attempt a dry-run merge
echo "--- Attempting dry-run merge ---"

# We need a temporary git identity for the merge attempt
GIT_NAME=$(git config user.name 2>/dev/null || echo "merge-check")
GIT_EMAIL=$(git config user.email 2>/dev/null || echo "merge-check@localhost")
git config user.name "$GIT_NAME"
git config user.email "$GIT_EMAIL"

if git merge --no-commit --no-ff "upstream/$UPSTREAM_BRANCH" >/dev/null 2>&1; then
  echo "RESULT: Clean merge -- no conflicts."
  echo ""
  echo "To actually merge, run:"
  echo "  git fetch upstream $UPSTREAM_BRANCH"
  echo "  git merge upstream/$UPSTREAM_BRANCH"
  # Abort the uncommitted merge
  git merge --abort 2>/dev/null || true
else
  echo "RESULT: CONFLICTS DETECTED"
  echo ""
  echo "Conflicting files:"
  git diff --name-only --diff-filter=U
  echo ""
  echo "You will need to resolve these conflicts manually when merging."
  # Clean up
  git merge --abort 2>/dev/null || true
  exit 1
fi

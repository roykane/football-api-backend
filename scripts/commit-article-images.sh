#!/usr/bin/env bash
# Stage + commit any untracked admin-uploaded article hero images so they
# don't get wiped on the next deploy/rsync. Run after a batch of /admin
# uploads:
#
#   bash scripts/commit-article-images.sh
#
# No-op if nothing changed.

set -e
cd "$(dirname "$0")/.."

if git diff --quiet --exit-code public/article-images && \
   [ -z "$(git status --porcelain public/article-images)" ]; then
  echo "no new article-images to commit"
  exit 0
fi

COUNT=$(git status --porcelain public/article-images | wc -l | tr -d ' ')
git add public/article-images
git commit -m "Snapshot $COUNT admin-uploaded article images"
echo "committed $COUNT files. push with: git push origin main"

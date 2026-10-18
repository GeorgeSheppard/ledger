#!/bin/sh
# Part of `pnpm build`. Preview builds (any branch other than the production one) also ship Storybook
# at /storybook/, so a PR's preview URL shows the stories. It needs no secrets and never goes into
# the production build. WORKERS_CI_BRANCH is set by Cloudflare Workers Builds; locally it is empty,
# so nothing is added.
set -eu

if [ -n "${WORKERS_CI_BRANCH:-}" ] && [ "$WORKERS_CI_BRANCH" != "${PRODUCTION_BRANCH:-main}" ]; then
  pnpm build-storybook -o dist/storybook
fi

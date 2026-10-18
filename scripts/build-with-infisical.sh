#!/bin/sh
# Production build with the Google settings (VITE_*) pulled from Infisical. This is the Cloudflare
# build command; see docs/SECRETS.md. Plain `pnpm build` still works without Infisical (demo data).
set -eu

INFISICAL_CLI="@infisical/cli@0.43.138"

: "${INFISICAL_CLIENT_ID:?Set INFISICAL_CLIENT_ID (machine identity) as a Cloudflare build variable}"
: "${INFISICAL_CLIENT_SECRET:?Set INFISICAL_CLIENT_SECRET (machine identity) as a Cloudflare build secret}"
: "${INFISICAL_PROJECT_ID:?Set INFISICAL_PROJECT_ID as a Cloudflare build variable}"
INFISICAL_ENV="${INFISICAL_ENV:-prod}"

INFISICAL_TOKEN="$(pnpm dlx "$INFISICAL_CLI" login --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" --silent --plain)"
export INFISICAL_TOKEN

pnpm dlx "$INFISICAL_CLI" run --projectId="$INFISICAL_PROJECT_ID" --env="$INFISICAL_ENV" \
  -- pnpm build

# Preview builds (any branch other than the production one) also ship Storybook at /storybook/, so a
# PR's preview URL shows the stories. It needs no secrets and never goes into the production build.
# WORKERS_CI_BRANCH is set by Cloudflare Workers Builds; locally it is empty, so nothing is added.
if [ -n "${WORKERS_CI_BRANCH:-}" ] && [ "$WORKERS_CI_BRANCH" != "${PRODUCTION_BRANCH:-main}" ]; then
  pnpm build-storybook -o dist/storybook
fi

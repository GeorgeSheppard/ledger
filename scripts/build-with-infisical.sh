#!/bin/sh
# Production build with the Google settings (VITE_*) pulled from Infisical. This is the Cloudflare
# build command; see docs/SECRETS.md. Plain `pnpm build` still works without Infisical; Google is then shown as unavailable.
set -eu

INFISICAL_CLI="@infisical/cli@0.43.138"

: "${INFISICAL_CLIENT_ID:?Set INFISICAL_CLIENT_ID (machine identity) as a Cloudflare build variable}"
: "${INFISICAL_CLIENT_SECRET:?Set INFISICAL_CLIENT_SECRET (machine identity) as a Cloudflare build secret}"
: "${INFISICAL_PROJECT_ID:?Set INFISICAL_PROJECT_ID as a Cloudflare build variable}"
INFISICAL_ENV="${INFISICAL_ENV:-prod}"

INFISICAL_TOKEN="$(pnpm dlx "$INFISICAL_CLI" login --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" --silent --plain)"
export INFISICAL_TOKEN

exec pnpm dlx "$INFISICAL_CLI" run --projectId="$INFISICAL_PROJECT_ID" --env="$INFISICAL_ENV" \
  -- pnpm build

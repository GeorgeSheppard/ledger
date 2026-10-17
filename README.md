# Finance

The frontend for [finance.georgesheppard.dev](https://finance.georgesheppard.dev). Currently just an
"under construction" page.

## Stack

- **React 19 + Vite + TypeScript**

## Development

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm lint         # typecheck + eslint
pnpm format       # prettier
pnpm build
```

## Deployment

Deployed to Cloudflare Workers as static assets (`wrangler.jsonc`), with SPA fallback routing. The
build command is `pnpm build`, and the output directory is `dist`. Security headers are set in
`public/_headers`.

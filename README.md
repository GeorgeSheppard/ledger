# Finance

The frontend for [finance.georgesheppard.dev](https://finance.georgesheppard.dev): a personal finance
app whose data lives in the user's own Google Sheet. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the structure and conventions.

## Stack

- **React 19 + Vite + TypeScript**, React Router, Vitest

## Development

```sh
pnpm install
pnpm dev          # http://localhost:5173, uses demo data
pnpm test         # unit tests
pnpm lint         # typecheck + eslint
pnpm format       # prettier
pnpm build
```

To use a real Google Sheet instead of demo data, follow [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md)
to create the Google credentials, then put them in `.env.local` (see `.env.example`).

## Deployment

Deployed to Cloudflare Workers as static assets (`wrangler.jsonc`), with SPA fallback routing. The
build command is `pnpm build`, and the output directory is `dist`. Security headers, including the
Content-Security-Policy that allows Google sign-in, the Picker and the Sheets API, are set in
`public/_headers`. Set `VITE_DATA_SOURCE`, `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` as build
variables.

# Storybook and screenshots

Storybook shows the shared components, pages and dialogs on realistic demo data, without a Google
account. It exists so UI changes can be reviewed from pictures: a reviewer should not have to build a
spreadsheet of the right shape to see what a graph or dialog looks like.

```sh
pnpm storybook         # dev server on http://localhost:6006
pnpm build-storybook   # static build in storybook-static/
```

Light and dark follow the browser's colour scheme, like the app (the tokens in `styles/global.css`
use `prefers-color-scheme`). To see dark in Storybook, switch your OS or use the browser's rendering
emulation.

## How stories get their data

Stories do not mock the store. `src/storybook/providers.tsx` wraps them in the app's own
`SessionProvider` (demo mode), `LedgerDataProvider` and `ShortcutProvider`, so a page reads and writes
a real `LedgerStore` filled from `src/lib/data/fixtures.ts`. To show a different state, change the
fixtures, or seed the store before the story renders (as `Connected` does for a dashboard layout).

- `Connected` is a connected demo spreadsheet. Use `shell` to put the page in the sidebar frame, and
  `route` for pages that read the URL. Pass `dashboard` to choose the dashboard widgets.
- `SignedIn` is signed in but not connected (the connect page). `AppProviders` is just the router,
  session and shortcuts.
- A story that needs user input uses a `play` function; see `Dialogs/Import → Preview`, which
  uploads a CSV.

Add a story next to the component: `Foo.tsx` → `Foo.stories.tsx`, titled `UI/…`, `Pages/…` or
`Dialogs/…`. Story ids come from the title and name, e.g. `Pages/Dashboard` + `Sankey` →
`pages-dashboard--sankey`.

## Screenshots

```sh
pnpm screenshots --list                              # every story id
pnpm screenshots pages-dashboard--sankey             # one story, light and dark
pnpm screenshots pages-dashboard dialogs-import      # every story whose id starts with these
pnpm screenshots all --scheme dark --out /tmp/shots  # everything, dark only
pnpm screenshots pages-paychecks --no-build          # reuse the last build
```

It builds Storybook, serves it locally, and saves `<story-id>.<light|dark>.png` (full page, 1280 px
wide by default; `--width` changes it) into `screenshots/`, which is git-ignored. It uses the Chromium
already installed on the machine (`CHROMIUM_PATH` overrides where) and never downloads one.

## Pictures on a PR

For any change a user can see:

1. Add or update the story that shows it (a new state gets its own story).
2. Take screenshots of the affected stories on your branch. For a change to something that already
   exists, also take them on `main` (`git stash`, or a second checkout) and name the output folders
   `before` and `after`.
3. Commit the PNGs you want reviewers to see under `.github/pr-screenshots/<branch-name>/`, push, and
   link them in the PR description with commit-pinned URLs so they keep working:
   `![Sankey](https://github.com/GeorgeSheppard/ledger/blob/<commit-sha>/.github/pr-screenshots/<branch-name>/after.png?raw=true)`.
   Keep it to the few images that matter (a PR needs a handful, not every story).
4. Put a **Before** / **After** pair in the description where something changed, and say which story
   id each came from so it can be reproduced.

The screenshots folder can be deleted once the PR is merged; the commit-pinned links in the merged PR
keep working.

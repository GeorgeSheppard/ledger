# Architecture

Ledger is a static React app. All user data lives in the user's own Google Sheet; the app reads and
writes it from the browser. There is no backend.

## Principles

1. **Business logic is plain TypeScript in `src/lib/`.** No React, no DOM, no `fetch` to Google
   outside `src/lib/google/`. Every module in `lib/` is unit-tested with Vitest (`*.test.ts` next to
   the file).
2. **UI lives in `src/features/<feature>/` and `src/ui/`.** Components render and handle input; they
   call `lib/` functions and the data hooks. They do not compute balances, parse CSVs or talk to
   Google.
3. **One data seam.** Features only read and write through `LedgerRepository`
   (`src/lib/data/repository.ts`), via the hooks in `src/state/ledgerData.tsx`. In dev the repository
   is `MemoryRepository` seeded with demo data, so every feature can be built without Google
   credentials.
4. **Every action has a shortcut, shown next to its button.** Shortcuts are declared once in
   `src/lib/shortcuts/bindings.ts`; buttons are `<ActionButton shortcut="…">`.
5. **Styling is Tailwind only.** See [Styling](#styling) below. No `.css` files besides
   `src/styles/global.css`.

## File structure

```
src/
  main.tsx                     entry point
  vite-env.d.ts                env var types (VITE_DATA_SOURCE, VITE_GOOGLE_*)
  app/                         wiring only: providers, routes, shell
    App.tsx                    providers + router
    routes.tsx                 route table and connection guard
    paths.ts                   URL helpers, use instead of string literals
    AppShell.tsx               sidebar nav, sheet name, shortcut help
  state/                       React glue between lib/ and the UI
    session.tsx                useSession(): signed-out | signed-in | connected
    ledgerData.tsx             useRepository(), useLedgerQuery(), useLedgerMutation()
    shortcuts.tsx              ShortcutProvider, useShortcut(id, handler)
  ui/                          shared presentational components, no data access
    ActionButton.tsx           button + its shortcut (variants: primary, secondary, ghost, danger)
    Page.tsx                   page frame: title, description, header actions
    Card.tsx                   bordered surface for tables, charts, forms
    Kbd.tsx                    renders a shortcut's keys
    ShortcutHelp.tsx           `?` overlay listing every shortcut
    cn.ts                      class name joiner (clsx + tailwind-merge)
  styles/
    global.css                 Tailwind import, design tokens (light + dark), base styles
  lib/                         pure TypeScript, unit tested
    domain/types.ts            Account, Transaction, TransactionInput, Category, SpreadsheetRef
    data/repository.ts         LedgerRepository interface
    data/memoryRepository.ts   in-memory implementation
    data/fixtures.ts           demo data (2 accounts, 6 months)
    shortcuts/                 key parsing and formatting, the bindings table
    transactions/              running totals, sorting, validation, formatting
    categories/                category list operations
    google/                    auth, picker, Sheets API client, GoogleSheetsRepository
    connection/                remembering which spreadsheet is connected
    metrics/                   net worth series, monthly spend by category
    csv/                       parsing, column mapping, reconciliation
  features/                    one folder per feature: pages, components, feature hooks
    landing/                   public homepage
    connect/                   sign in, pick or create a sheet
    accounts/                  accounts summary, account menu, transaction table, inline editing
    categories/                category management page
    dashboard/                 charts
    import/                    Import data dialog: CSV drag and drop, mapping, review
```

## Styling

Tailwind CSS v4, configured in `src/styles/global.css`. Keep the look consistent by reaching for the
same few pieces everywhere:

- **Colours come only from the theme tokens**, which switch automatically for dark mode. Never use
  raw hex values or Tailwind palette colours like `bg-gray-100` or `text-red-500`.

  | Token                   | Use for                             | Example classes                              |
  | ----------------------- | ----------------------------------- | -------------------------------------------- |
  | `canvas`                | page background                     | `bg-canvas`                                  |
  | `surface`               | cards, sidebar, inputs, dialogs     | `bg-surface`, `hover:bg-surface-hover`       |
  | `line`                  | every border and divider            | `border-line`, `divide-line`                 |
  | `fg` / `muted`          | primary / secondary text            | `text-fg`, `text-muted`                      |
  | `accent`                | primary actions, focus rings, links | `bg-accent text-accent-fg`, `outline-accent` |
  | `positive` / `negative` | money in / money out, errors        | `text-positive`, `text-negative`             |

  Category colours come from the data (`Category.color`) and are applied with `style`, not classes.

- **Spacing, radii and type** use Tailwind's default scale. House defaults: page padding via
  `<Page>`; `gap-6` between page sections; `rounded-xl` for cards and dialogs, `rounded-lg` for
  buttons, inputs and rows; `text-sm` for UI and table text; `text-2xl font-semibold` only for page
  titles (via `<Page>`), `text-lg font-semibold` for card titles.
- **Numbers** (amounts, totals, chart labels) use `tabular-nums`; amounts are coloured with
  `text-positive` / `text-negative`.
- **Use the shared components** before writing new markup: `<Page>` for every page, `<Card>` for
  grouped content, `<ActionButton>` for every action. If two features need the same styled element
  (an input, a select, a badge), add it to `src/ui/` rather than copying classes.
- **Composing classes:** use `cn(...)` from `src/ui/cn.ts` for conditional classes and for letting a
  `className` prop override defaults. Components that render a root element accept `className`.
- **Interactive states:** `hover:bg-surface-hover`, `focus-visible:outline-2
focus-visible:outline-offset-2 focus-visible:outline-accent`, `disabled:opacity-50`.
- Prettier sorts Tailwind classes (`prettier-plugin-tailwindcss`); run `pnpm format`.

## Sheet format

- Every tab is an account, except tabs whose name starts with `_`.
- Account tabs: row 1 is the header `Date | Category | Amount | Note | Total`, data from row 2.
  - Date is written as a real date cell; the app uses `YYYY-MM-DD` strings.
  - Amount is a number: positive is money in, negative is money out.
  - Total is a running-balance formula written by the app (e.g. `=SUM($C$2:C2)`), so it stays
    correct when the user edits the sheet directly. The app reads it but never writes a value.
- `_Categories` tab: header `Name | Color`, one category per row.
- Transactions are addressed by row number. After any write, re-read rather than patching state;
  `useLedgerMutation()` does this automatically.

## Shared contracts

These are in the scaffold and should not change without agreement across threads:

- `src/lib/domain/types.ts`
- `src/lib/data/repository.ts` (`LedgerRepository`)
- `src/state/session.tsx` (`Session`, `SessionApi`, `useSession`)
- `src/state/ledgerData.tsx` (`useRepository`, `useLedgerQuery`, `useLedgerMutation`)
- `src/state/shortcuts.tsx` and `src/ui/ActionButton.tsx`
- `src/app/paths.ts`

If a feature needs a contract change (e.g. a new repository method), add it to the interface **and**
`MemoryRepository` with a test, keep it additive, and call it out in the PR description.

## Ownership for the parallel work

Each thread owns its folders and replaces its placeholder page. Files outside your folders are only
touched additively.

| Thread                                | Owns                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1. Google connection and landing page | `features/landing`, `features/connect`, `lib/google`, `lib/connection`, Google mode in `state/session.tsx`, `public/_headers` |
| 2. Accounts and transactions          | `features/accounts`, `features/categories`, `lib/transactions`, `lib/categories`                                              |
| 3. Dashboard                          | `features/dashboard`, `lib/metrics`                                                                                           |
| 4. CSV import                         | `features/import`, `lib/csv`                                                                                                  |

Shared files each thread may edit additively:

- `src/lib/shortcuts/bindings.ts`: add entries in your section only. Keys for the planned actions are
  already reserved there.
- `package.json` / `pnpm-lock.yaml`: add dependencies you need (e.g. a chart library for step 3, a
  CSV parser for step 4). Expect a trivial lockfile merge.
- `src/lib/data/repository.ts` + `memoryRepository.ts`: additive methods only, as above.

### Notes per thread

1. **Google connection.** Use Google Identity Services (token model) for sign-in and the Google
   Picker with the `drive.file` scope, so the app only sees sheets the user picks or creates.
   Implement `GoogleSheetsRepository implements LedgerRepository` in `lib/google/` and switch
   `SessionProvider` to it when `VITE_DATA_SOURCE=google`. Creating a sheet creates one account tab
   and `_Categories` with sensible defaults. Update the CSP in `public/_headers` for Google domains.
2. **Accounts and transactions.** `/accounts` is a read-only summary of every account (balance,
   transaction count, last activity) where accounts can be renamed or added; `/accounts/:accountId`
   shows one account's transactions, newest date first. Account menu with `/` to switch and
   `[`/`]` to cycle, inline editing (select a row to edit it; `enter` edit, `mod+enter` save,
   `escape` cancel), `n` adds a row at the top of the editor. Category picker with "add new"
   inline. Categories page for add / rename (`renameCategory`) / recolour / delete.
3. **Dashboard.** Pure functions in `lib/metrics/` (net worth over time across accounts, spend per
   category per month, month-over-month totals), charts in `features/dashboard/`.
4. **CSV import.** `lib/csv/` parses, guesses the mapping from the header row (date, amount or
   debit/credit columns, description), normalises dates and amounts, and reconciles against existing
   transactions (same date + amount + note counts as existing). UI: an "Import data" button on each
   account page opens a dialog with a drop zone and file picker, editable column mapping, preview
   showing new vs already-present rows, confirm.

## Running

```sh
pnpm dev     # demo data, no Google account needed
pnpm test    # unit tests for lib/
pnpm lint
pnpm build
```

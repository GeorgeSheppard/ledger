# Architecture

Ledger is a static React app. All user data lives in the user's own Google Sheet; the app reads and
writes it from the browser. There is no backend.

## Principles

1. **Business logic is plain TypeScript in `src/lib/`.** No React, no DOM, no `fetch` to Google
   outside the Sheets client in `src/lib/google/` and the Google modules. Everything in `lib/` is
   unit-tested with Vitest (`*.test.ts` next to the file).
2. **The parts you can pick and choose are modules, in `src/modules/`.** Where the data comes from,
   how it is saved back, how bank data is imported and which graphs the dashboard offers each have
   one folder, one interface and one implementation folder per option. See [Modules](#modules).
3. **UI lives in `src/features/<feature>/`, `src/modules/*/ui` and `src/ui/`.** Components render
   and handle input; they call `lib/` functions and the data hooks. They do not compute balances,
   parse CSVs or talk to Google.
4. **One data seam.** Features read the spreadsheet with `useLedger()` and write through
   `useRepository()` (a `LedgerStore`, which implements `LedgerRepository`), both in
   `src/state/ledgerData.tsx`. In dev the store is backed by `MemoryRemote` seeded with demo data,
   so every feature can be built without Google credentials. See [Data flow](#data-flow).
5. **Frequent actions have a shortcut, shown next to the button; rare ones have none.** Shortcuts are declared once in
   `src/lib/shortcuts/bindings.ts`; buttons are `<ActionButton shortcut="…">`.
6. **Styling is Tailwind only.** See [Styling](#styling) below. No `.css` files besides
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
    AppShell.tsx               sidebar nav, sheet name; a top bar on phones
  state/                       React glue between lib/ and the UI
    session.tsx                useSession(): signed-out | signed-in | connected
    ledgerData.tsx             useLedger(), useRepository(), useSyncStatus()
    shortcuts.tsx              ShortcutProvider, useShortcut(id, handler)
  ui/                          shared presentational components, no data access
    ActionButton.tsx           button + its shortcut (variants: primary, secondary, ghost, danger)
    Page.tsx                   page frame: title, description, header actions
    Card.tsx                   bordered surface for tables, charts, forms
    Kbd.tsx                    renders a shortcut's keys
    cn.ts                      class name joiner (clsx + tailwind-merge)
  storybook/                   providers for stories (real session and store, demo data)
  styles/
    global.css                 Tailwind import, design tokens (light + dark), base styles
  lib/                         pure TypeScript, unit tested
    domain/types.ts            Account, Transaction, TransactionInput, Category, SpreadsheetRef
    data/repository.ts         LedgerRepository interface
    data/fixtures.ts           demo data (2 accounts, 6 months)
    store/                     LedgerStore (working copy, autosave), LedgerRemote, IndexedDB cache
    shortcuts/                 key parsing and formatting, the bindings table
    transactions/              running totals, sorting, selection, validation, formatting
    categories/                category list operations
    google/                    Sheets API client and the sheet format parser (shared by Google and .xlsx)
    files/                     ExcelJS loading shared by reading and writing .xlsx files
    metrics/                   net worth series, monthly spend by category
    csv/                       CSV text → rows (Papa Parse)
    dashboard/                 dashboard layout (widgets) as stored in the sheet; not editable for now
    paychecks/                 paychecks and the money-flow calculation
  modules/                     the pick-and-choose parts of the app, see "Modules" below
    ingest/                    getting a ledger in: Google, a file on this device
    import/                    turning bank data into transactions: CSV, pasted text
    graphs/                    dashboard graphs: one folder per graph, plus a registry
    save/                      pushing changes back where the ledger came from
  features/                    one folder per page: pages, components, feature hooks
    landing/                   public homepage
    connect/                   Get started dialog (driven by the ingest options), switch spreadsheet
    accounts/                  accounts summary, account menu, transaction table, inline editing
    categories/                category management page
    dashboard/                 the dashboard page: date range, shared filters, graph frame
    paychecks/                 paychecks page
    legal/                     privacy policy and terms
```

## Modules

The app is a few interchangeable parts. Each is a folder under `src/modules/` with a small
interface in `types.ts`, a public `index.ts`, and one folder per implementation. Adding an option
means adding a folder and one line in the group's `index.ts`; removing one means deleting them.
`src/modules/modules.test.ts` fails if an implementation imports a sibling, or if one group reaches
into another group's internals instead of its `index.ts`.

```
src/modules/
  ingest/        Ingest<Input>.open(input) → Connection { title, load(), saver }
    google/        reads a Google Sheet (plus sign-in, Picker, create)
    local-file/    reads .xlsx / .csv from the device, or starts a blank ledger
  save/          Saver { save(base, next), download?(data) }
    cloud/         one batchUpdate to the Google Sheet
    local-file/    keeps changes in memory; download() builds the updated .xlsx
    ui/            Save button and status
  import/        Importer { id, label, accepts, parse(input, options) → ParsedImport }
    csv/           a CSV file; delimiter and header row detected
    pasted-text/   text copied from a bank's website, read with heuristics
    shared/        mapping, values, reconcile and import plan, common to every importer
    ui/            Import data dialog (drop zone, paste box, mapping, preview)
  graphs/        Graph { kind, label, defaultWidth, title(), Options?, View }
    stat/ net-worth/ balances/ spending/ breakdown/ cash-flow/ sankey/
    shared/        chart primitives (time view, Chart.js setup, legend, theme, formatting)
```

- **Ingest and save.** Whatever the source, `remoteOf(connection)` gives the store one `LedgerRemote`.
  The store loads once, keeps the working copy in IndexedDB and calls the saver with the last saved
  state and the new one, so everything after ingest behaves the same. A connection pairs its reader
  with the saver that writes back to where the data came from: `cloud` flushes the batched updates
  to the sheet, `local-file` turns Save into Download. A new source is an `Ingest` that returns a
  `Connection` with its own saver.
- **Get started.** The homepage only explains Ledger; its Get started button opens a dialog listing
  `INGEST_OPTIONS` (`modules/ingest/index.ts`). Each `IngestOption` has a title, a description and a
  `Setup` component that walks through that option. A new ingest module adds its option to the
  registry and appears in the dialog with no change to the landing or connect features.
- **Import.** Every importer returns the same `ParsedImport` (a table, the guessed column mapping,
  warnings and, for free-form dates, the day/month order), so the preview, mapping editor and
  import plan do not know which one ran. Register new importers in `import/index.ts`.
- **Graphs.** The dashboard has a fixed layout: every graph in `GRAPHS` is drawn in order, each
  given the same props (`modules/graphs/types.ts`): one date range (`Period`, `lib/metrics/period.ts`),
  the accounts switched on and the categories picked. The page (`features/dashboard`) owns that
  state. The range comes from the date picker, from dragging across the balances graph, or from
  clicking a spending column; accounts are switched on and off in the balances legend and
  categories in the spending legend or breakdown table, and every graph follows. Balances are not
  narrowed by category, and the money-flow Sankey keeps every spending node but outlines the picked ones and dims the rest; clicking a spending node picks or clears it, and Back (`b`) undoes category picks along with date changes (`lib/metrics/viewHistory.ts`). Every Sankey column is sorted largest first. The `_Dashboard` tab
  of the sheet (the old widget layout) is still read and written back untouched, but layout editing
  is switched off for now.
- **Time graphs.** Balances, spending and income/spending are drawn with Chart.js
  (`lib/metrics/timeSeries.ts` cuts a period into months, weeks or days, `granularityFor`;
  `shared/timeView.tsx` feeds the visible range to Chart.js). Sankey and the breakdown stay on d3
  and plain markup. "View transactions" sits at the top of the page
  (`features/dashboard/ViewTransactions.tsx`) and opens `/transactions`
  (`features/accounts/TransactionsPage.tsx`), every account's transactions in one list, with the
  view's dates, categories and accounts as URL filters (`lib/transactions/filterParams.ts`).

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

## Floating panels

Anything that opens next to a control (a menu, a filter panel, a dropdown list, a switcher) is built
on `src/ui/FloatingPanel.tsx`, never on `position: absolute` inside the page. The panel is portaled to
`<body>` (into the `<dialog>` when the anchor is in one), positioned and flipped by Floating UI, sits
at `z-50`, and closes on an outside press, on scroll and on a width change. This is what stops a
virtualised table row's stacking context or an `overflow` parent from clipping it or painting later
rows over it. `Menu`, `Popover`, `CategoryPicker` and `AccountSwitcher` all use it; a click-away
handler that must ignore panels matches `FLOATING_SELECTOR`. Escape and arrow keys stay with each
component, which stops them reaching the page shortcuts. Nothing else should use a z-index above
`z-10`. Native `<select>` is drawn by the browser and needs none of this; native `title` tooltips
likewise. Charts have no hover tooltips.

`UI/Floating panels` stories and the panels' own stories assert with `expectOnTop`
(`src/storybook/floating.ts`) that the browser really paints the panel on top and inside the
viewport. `pnpm screenshots <story-id>` runs the play functions and exits 1 when one fails.

## Sheet format

- A tab is an account only if it matches the format exactly; anything else is ignored and listed
  in `useLedger().skippedTabs` with the reason. Tabs whose name starts with `_` are never accounts.
- Account tabs: row 1 is exactly `Date | Category | Amount | Note | Total` with nothing after it,
  data from row 2. Every non-blank row needs a real date and a numeric amount.
  - Date is written as a real date cell; the app uses `YYYY-MM-DD` strings.
  - Amount is a number: positive is money in, negative is money out.
  - Rows are kept in date order (oldest first). Total is a running-balance formula written by the
    app (e.g. `=SUM($C$2:C2)`), so it stays correct when the user edits the sheet directly. The app
    computes totals itself and never reads the Total column.
- `_Metadata` tab: header `Type | Name | Setting | Value`, one setting per row. It holds everything
  the app remembers about the spreadsheet that is not a transaction:
  - `category | Food | color | #4f7cff`: one row per category, in list order.
  - `category | Interest | account | Savings`: limits the category to an account (tab name); one row
    per account. A category with no `account` rows is global. The limit only decides what the
    category picker on an account offers: charts and rules still group by name, and transactions
    may use any name. Renaming an account updates these rows.
  - `category | Gym | archived | TRUE`: the category is archived. Written only for archived ones; a
    missing row means active. Archived categories are hidden from category lists and pickers (and
    listed under "Archived" on the categories page, where they can be restored), but transactions
    keep the name, so graphs and filters still group by it.
  - `account | Visa | inverted | TRUE`: the account (tab name) is a credit card or loan. Written only
    for inverted accounts; a missing row means off.
  - Rows of an unknown type or setting are ignored, and the app rewrites the tab whole when
    categories or account settings change, so put hand notes elsewhere.
  - Old sheets have `_Categories` (`Name | Color`) instead. It is still read when there is no
    `_Metadata`; the next save of any change writes `_Metadata` and deletes `_Categories` in the same
    batch (the `.xlsx` writer does the same).
- **Inverted accounts.** A credit card or loan is recorded the way its statement reads: purchases and
  interest are positive, payments negative, so a card's CSV imports unchanged. Marking the account
  inverted (the checkbox in its page header, `LedgerRepository.setAccountInverted`) makes Ledger flip
  the sign of its amounts and running totals wherever it counts money (`src/lib/accounts/inverted.ts`):
  the accounts list and its total, the account page's balance and in/out summary, net worth, the
  balances graph, income and spending, and the Sankey. A purchase is money out and the balance owed
  is a negative contribution to net worth; paying the card from a bank account pairs up with the
  card's payment row as a transfer. The tab, its Total column and the transaction table stay as the
  sheet has them.
- `_Dashboard` tab: header `Config`, the dashboard layout as JSON in cell A2.
- `_Paychecks` tab: a plain table, one row per payslip line, so Excel can pivot and chart it:
  `Date | Tax code | Type | Name | Amount`. One payslip per date: its lines share the date, and
  `Tax code` (kept with the paycheck, never used in any sum, repeated on each line) is optional.
  `Type` is `Income`, `Benefit in kind` or `Deduction`, and `Amount` is always positive. The
  earlier layout with a `Paycheck` label in column B is still read (the label separates payslips on
  the same date) and is replaced by this one on the next change. Take-home pay is income less deductions; a benefit in
  kind (a taxable benefit not paid in cash) counts towards gross pay but not take-home pay. A paycheck is one payslip
  typed in by hand: nothing repeats and there is no schedule, account or one-per-month rule; the
  date only decides which months of the dashboard count it (`src/lib/paychecks`). The paychecks page
  adds, edits and deletes them and suggests names used before. The Sankey graph (a dashboard widget) follows
  the money for the months shown: income lines → gross pay → deductions and take-home pay →
  spending categories, ending in "Saved" (extra) or "Other income" (deficit), with take-home as one
  pool. Earlier layouts are still read: the one-cell JSON tab (header `Paychecks`, JSON in A2; the
  next change to the paychecks replaces it with the table) and, inside that JSON, a version 1
  schedule (one paycheck per payment made) or version 2 monthly payslips (dated on the month's last
  day) via `legacy.ts`.

## Data flow

The Sheets API allows 60 read and 60 write requests per minute per user, so the app never talks to
it per page or per edit:

1. **Load once.** When a spreadsheet is connected, the Google ingest reads the tab list and then
   every tab's values in one batch: two requests in total. Pages never load anything themselves.
2. **Edit locally.** `LedgerStore` holds the working copy. Edits apply at once (`useLedger()`
   re-renders) and are written to IndexedDB, so closing the page never loses them.
3. **Save in one batch.** Every minute, when the page is hidden, or when the user presses Save
   (`mod+s`), the `cloud` saver sends everything that changed in one `batchUpdate`. Changed
   account tabs are rewritten whole, in date order, with fresh Total formulas. `useSyncStatus()`
   reports `saved`, `unsaved`, `saving` or `error`.
4. **Exit clears it all.** The sidebar's Exit button (`app/ExitButton.tsx`) calls `useSession().exit()`:
   it stops autosave, empties the IndexedDB working copy, forgets the remembered spreadsheet,
   signs out of Google and returns to the landing page, for a Google Sheet and a file alike. With
   unsaved edits it first offers Save and exit (Download and exit for a file) / Exit without saving
   / Cancel, and discarding asks "Are you sure?" once more.
5. **Unsaved edits survive.** On the next load, edits still in IndexedDB are replayed on top of the
   fresh sheet, tab by tab: a tab changed locally keeps the local version, other tabs take the
   sheet's.

Transactions are addressed by row number, which is their position in date order. Adding or
redating a transaction can change other rows' numbers, so read rows from the latest `useLedger()`.

## Shared contracts

These should not change without agreement:

- `src/lib/domain/types.ts`
- `src/lib/data/repository.ts` (`LedgerRepository`)
- `src/state/session.tsx` (`Session`, `SessionApi`, `useSession`)
- `src/state/ledgerData.tsx` (`useLedger`, `useRepository`, `useSyncStatus`; `useLedgerQuery` and
  `useLedgerMutation` remain for older code)
- `src/lib/store/` (`LedgerStore`, `LedgerSnapshot`, `LedgerRemote`)
- `src/modules/*/types.ts` (`Ingest`, `Saver`, `Importer`, `Graph`)
- `src/state/shortcuts.tsx` and `src/ui/ActionButton.tsx`
- `src/app/paths.ts`

If a feature needs a contract change (e.g. a new repository method), add it to the interface **and**
`LedgerStore` with a test, keep it additive, and call it out in the PR description.

## Running

```sh
pnpm dev     # demo data, no Google account needed
pnpm test    # unit tests for lib/
pnpm lint
pnpm build
pnpm storybook         # components and pages with demo data, on :6006
pnpm screenshots <id>  # PNG screenshots of stories, for PRs
```

Stories (`*.stories.tsx`, next to the component they show) render pages and dialogs through the
real `SessionProvider` and `LedgerDataProvider` on the demo data, so what you see is what the app
shows. See [STORYBOOK.md](STORYBOOK.md), including how to put before/after images on a PR.

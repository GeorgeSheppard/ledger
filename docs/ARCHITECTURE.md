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
    AppShell.tsx               sidebar nav, sheet name, shortcut help
  state/                       React glue between lib/ and the UI
    session.tsx                useSession(): signed-out | signed-in | connected
    ledgerData.tsx             useLedger(), useRepository(), useSyncStatus()
    shortcuts.tsx              ShortcutProvider, useShortcut(id, handler)
  ui/                          shared presentational components, no data access
    ActionButton.tsx           button + its shortcut (variants: primary, secondary, ghost, danger)
    Page.tsx                   page frame: title, description, header actions
    Card.tsx                   bordered surface for tables, charts, forms
    Kbd.tsx                    renders a shortcut's keys
    ShortcutHelp.tsx           `?` overlay listing every shortcut
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
    transactions/              running totals, sorting, validation, formatting
    categories/                category list operations
    google/                    Sheets API client and the sheet format parser (shared by Google and .xlsx)
    files/                     ExcelJS loading shared by reading and writing .xlsx files
    metrics/                   net worth series, monthly spend by category
    csv/                       the CSV text parser
    dashboard/                 dashboard layout (widgets) and how it is stored
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
    dashboard/                 the dashboard page: layout editing, widget frame
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
    shared/        chart primitives (axes, legend, tooltip, theme, formatting)
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
- **Graphs.** The dashboard layout stores each widget's `kind` and settings. `WidgetView` looks the
  kind up in `GRAPHS` and renders its `View` with the widget's accounts, range and data worked out.
  A layout that mentions a removed graph shows "This graph is no longer available" and keeps the
  widget so nothing is lost.

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
- `_Paychecks` tab: header `Paychecks`, the paychecks as JSON in cell A2 (`src/lib/paychecks`). A
  paycheck is one month's payslip: a month, named income lines (salary, an allowance, a bonus...)
  and named deduction lines (income tax, pension...). Take-home pay is derived, and there is no
  account or schedule. The paychecks page adds a month, or copies the last one and suggests names
  used before. The dashboard's Sankey graph follows the money for the months shown: income lines →
  gross pay → deductions and take-home pay → spending categories and savings, with take-home as one
  pool. Version 1 data (a schedule and a destination account per paycheck) is converted to months
  when read (`legacy.ts`) and saved as version 2 with the next edit.

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
4. **Unsaved edits survive.** On the next load, edits still in IndexedDB are replayed on top of the
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

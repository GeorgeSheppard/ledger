import type { Meta, StoryObj } from '@storybook/react-vite';
import { Navigate, Route, Routes } from 'react-router';
import { paths } from '../../app/paths';
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test';
import { BIG_ACCOUNT_NAME, CREDIT_CARD_NAME, Connected } from '../../storybook/providers';
import { useLedger } from '../../state/ledgerData';
import { AccountsOverviewPage } from './AccountsOverviewPage';
import { AccountsPage } from './AccountsPage';
import { TransactionsPage } from './TransactionsPage';

const meta = { title: 'Pages/Accounts' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The summary of every account. */
export const Overview: Story = {
  render: () => (
    <Connected shell route="/accounts">
      <AccountsOverviewPage />
    </Connected>
  ),
};

/** One account with its transactions and running total. */
export const AccountPage: Story = {
  render: () => (
    <Connected shell route="/accounts/1">
      <Routes>
        <Route path="/accounts/:accountId" element={<AccountsPage />} />
      </Routes>
    </Connected>
  ),
};

/** Opened from the Total row of the accounts overview: every account, unfiltered. */
export const AllTransactions: Story = {
  render: () => (
    <Connected shell route="/transactions">
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>
    </Connected>
  ),
};

/** The account switcher lists "All accounts" first; picking it opens the combined list. */
export const SwitcherWithAllAccounts: Story = {
  render: () => (
    <Connected shell route="/accounts/1">
      <Routes>
        <Route path="/accounts/:accountId" element={<AccountsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>
    </Connected>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: /switch account/i }));
    await userEvent.click(await canvas.findByRole('option', { name: 'All accounts' }));
    await expect(await canvas.findByRole('heading', { name: 'All transactions' })).toBeVisible();
    await userEvent.click(await canvas.findByRole('button', { name: /switch account/i }));
    await expect(await canvas.findByRole('option', { name: /All accounts/ })).toHaveAttribute(
      'aria-selected'
    );
  },
};

/** Opened from a graph's "View transactions": every account in one list, already narrowed to a date range. */
export const AllTransactionsFromAGraph: Story = {
  render: () => (
    <Connected shell route="/transactions?from=2026-09-01&to=2026-09-30">
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>
    </Connected>
  ),
};

/**
 * A filtered combined list with a credit card. The totals count money in and out only: transfers,
 * the opening balances and the excluded Savings category are left out, and card purchases are money out.
 */
export const AllTransactionsSummary: Story = {
  render: () => (
    <Connected shell creditCard route="/transactions?from=2026-04-01&to=2026-09-30">
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>
    </Connected>
  ),
};

function AccountRoute() {
  return (
    <Connected shell route="/accounts/1">
      <Routes>
        <Route path="/accounts/:accountId" element={<AccountsPage />} />
      </Routes>
    </Connected>
  );
}

const rowsOf = (canvasElement: HTMLElement) =>
  within(canvasElement)
    .findAllByRole('row')
    .then((rows) => rows.filter((r) => r.dataset.rowId));

/** A click selects a row; clicking the selected row again (or double-clicking) opens it for editing. */
export const EditOnClick: Story = {
  render: AccountRoute,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [dinner] = await canvas.findAllByText('Dinner');
    await userEvent.click(dinner!);
    await expect(canvas.queryByRole('textbox', { name: 'Note' })).toBeNull();
    await userEvent.click(dinner!);
    await canvas.findByRole('textbox', { name: 'Note' });
  },
};

/**
 * The category list on an account: global categories plus the ones limited to it. Interest is
 * limited to Savings, so it is missing from the Current account's list (account 1) and present on
 * Savings (account 2).
 */
export const CategoryPickerOnAccount: Story = {
  render: () => (
    <Connected shell route="/accounts/1">
      <Routes>
        <Route path="/accounts/:accountId" element={<AccountsPage />} />
      </Routes>
    </Connected>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [dinner] = await canvas.findAllByText('Dinner');
    await userEvent.click(dinner!);
    await userEvent.click(dinner!);
    const picker = await canvas.findByRole('combobox', { name: 'Category' });
    await userEvent.clear(picker);
    await canvas.findByRole('option', { name: 'Groceries' });
    await expect(canvas.queryByRole('option', { name: 'Interest' })).toBeNull();
  },
};

/** Click, Shift+click and Ctrl/⌘+click select several rows; Delete, Select all and Clear appear once something is selected. */
export const SelectedRows: Story = {
  render: AccountRoute,
  play: async ({ canvasElement }) => {
    const rows = await rowsOf(canvasElement);
    await userEvent.click(within(rows[0]!).getByText(/./, { selector: '[data-field="note"]' }));
    fireEvent.click(within(rows[2]!).getByText(/./, { selector: '[data-field="note"]' }), {
      shiftKey: true,
    });
    fireEvent.click(within(rows[7]!).getByText('Monthly rent'), { ctrlKey: true });
  },
};

/** Confirming a delete of several rows. */
export const DeleteSelected: Story = {
  render: AccountRoute,
  play: async (context) => {
    await SelectedRows.play!(context);
    await userEvent.click(within(context.canvasElement).getByRole('button', { name: /^Delete 4/ }));
  },
};

/** The menu at the end of a row. */
export const RowMenu: Story = {
  render: AccountRoute,
  play: async ({ canvasElement }) => {
    const [first] = await rowsOf(canvasElement);
    await userEvent.click(within(first!).getByRole('button', { name: /^Actions for/ }));
  },
};

/** Filters live on the column headers: the Amount one is open, with money out over 70 typed in. */
export const Filtered: Story = {
  render: AccountRoute,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Filter by note' }));
    await userEvent.type(
      within(document.body).getByRole('searchbox', { name: 'Search transactions' }),
      'super'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Filter by amount' }));
    const body = within(document.body);
    await userEvent.click(body.getByRole('button', { name: 'Money out' }));
    await userEvent.type(body.getByRole('textbox', { name: 'Smallest amount' }), '70');
  },
};

/** Sorted by amount, smallest first. */
export const SortedByAmount: Story = {
  render: AccountRoute,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Amount' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Amount' }));
  },
};

/** A third click on Amount clears the sort, back to the default order grouped by month. */
export const SortCleared: Story = {
  render: AccountRoute,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Amount' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Amount' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Amount' }));
  },
};

/** "Find all duplicate transactions", after copying a row so there is one to find. */
export const Duplicates: Story = {
  render: AccountRoute,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [first] = await rowsOf(canvasElement);
    await userEvent.click(within(first!).getByRole('button', { name: /^Actions for/ }));
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Duplicate this transaction' }));
    await waitFor(async () => expect((await rowsOf(canvasElement)).length).toBeGreaterThan(40));
    const [top] = await rowsOf(canvasElement);
    await userEvent.click(within(top!).getByRole('button', { name: /^Actions for/ }));
    await userEvent.click(
      canvas.getByRole('menuitem', { name: 'Find all duplicate transactions' })
    );
  },
};

/** Opens the seeded credit card's own page. */
function OpenCreditCard() {
  const card = useLedger().accounts.find((a) => a.name === CREDIT_CARD_NAME);
  return card ? <Navigate to={paths.account(card.id)} replace /> : null;
}

/**
 * A credit card tab: purchases are positive in the sheet, and the account is marked as a credit
 * card or loan, so the balance counts as money owed.
 */
export const CreditCard: Story = {
  render: () => (
    <Connected shell creditCard route="/open-card">
      <Routes>
        <Route path="/open-card" element={<OpenCreditCard />} />
        <Route path="/accounts/:accountId" element={<AccountsPage />} />
      </Routes>
    </Connected>
  ),
};

/** The card counts against the total instead of adding to it. */
export const OverviewWithCreditCard: Story = {
  render: () => (
    <Connected shell creditCard route="/accounts">
      <AccountsOverviewPage />
    </Connected>
  ),
};

/** Clicking the account name edits it in place; there is no Rename button. */
export const RenameInPlace: Story = {
  render: AccountRoute,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', { name: 'Current account' })
    );
  },
};

function OpenByName({ name }: { name: string }) {
  const found = useLedger().accounts.find((a) => a.name === name);
  return found ? <Navigate to={paths.account(found.id)} replace /> : null;
}

/** 20,000 transactions: only the rows near the viewport are rendered, so it opens and scrolls like a short one. */
export const LargeAccount: Story = {
  render: () => (
    <Connected shell bigAccount={20_000} route="/open-big">
      <Routes>
        <Route path="/open-big" element={<OpenByName name={BIG_ACCOUNT_NAME} />} />
        <Route path="/accounts/:accountId" element={<AccountsPage />} />
      </Routes>
    </Connected>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Big account');
    await userEvent.click((await rowsOf(canvasElement))[0]!);
    await userEvent.click(await canvas.findByRole('button', { name: /^Select all/ }));
    await expect(await canvas.findByText('20,000 selected')).toBeTruthy();
    // Selecting everything leaves the page where it was.
    await expect(window.scrollY).toBeLessThan(100);
    await expect((await rowsOf(canvasElement)).length).toBeLessThan(60);
  },
};

/** The overview sorted by balance, highest first. */
export const OverviewSorted: Story = {
  render: () => (
    <Connected shell creditCard route="/accounts">
      <AccountsOverviewPage />
    </Connected>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Balance' }));
  },
};

/** The account's Settings tab, where "Credit card or loan" lives. */
export const Settings: Story = {
  render: () => (
    <Connected shell route="/accounts/1?tab=settings">
      <Routes>
        <Route path="/accounts/:accountId" element={<AccountsPage />} />
      </Routes>
    </Connected>
  ),
};

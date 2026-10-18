import type { Meta, StoryObj } from '@storybook/react-vite';
import { Navigate, Route, Routes } from 'react-router';
import { paths } from '../../app/paths';
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test';
import { CREDIT_CARD_NAME, Connected } from '../../storybook/providers';
import { useLedger } from '../../state/ledgerData';
import { AccountsOverviewPage } from './AccountsOverviewPage';
import { AccountsPage } from './AccountsPage';

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

/** Clicking a cell opens that row for editing straight away; there is no Edit button. */
export const EditOnClick: Story = {
  render: AccountRoute,
  play: async ({ canvasElement }) => {
    const [first] = await rowsOf(canvasElement);
    await userEvent.click(within(first!).getByText('Dinner'));
    await within(canvasElement).findByRole('textbox', { name: 'Note' });
  },
};

/** Ctrl/⌘+click and Shift+click select several rows; Delete is enabled once something is selected. */
export const SelectedRows: Story = {
  render: AccountRoute,
  play: async ({ canvasElement }) => {
    const rows = await rowsOf(canvasElement);
    await userEvent.click(within(rows[0]!).getByRole('checkbox'));
    fireEvent.click(within(rows[2]!).getByRole('checkbox'), { shiftKey: true });
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

/** Search plus the filter panel: money out over 50, in a date range. */
export const Filtered: Story = {
  render: AccountRoute,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      await canvas.findByRole('searchbox', { name: 'Search transactions' }),
      'super'
    );
    await userEvent.click(canvas.getByRole('button', { name: /^Filters/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Money out' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Smallest amount' }), '70');
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

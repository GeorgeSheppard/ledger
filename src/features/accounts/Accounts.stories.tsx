import type { Meta, StoryObj } from '@storybook/react-vite';
import { Navigate, Route, Routes } from 'react-router';
import { paths } from '../../app/paths';
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

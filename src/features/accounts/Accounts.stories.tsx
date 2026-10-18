import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router';
import { Connected } from '../../storybook/providers';
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

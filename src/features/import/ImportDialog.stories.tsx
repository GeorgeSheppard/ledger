import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, waitFor, within } from 'storybook/test';
import { useLedger } from '../../state/ledgerData';
import { Connected } from '../../storybook/providers';
import { ImportDialog } from './ImportDialog';

const meta = { title: 'Dialogs/Import' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Bank-style export: some rows are already in the demo account, some are new. */
const CSV = `Date,Description,Amount
2026-09-03,Supermarket,-64.20
2026-09-12,Dinner,-28.50
2026-10-02,Coffee beans,-12.80
2026-10-05,Refund,23.40
2026-10-09,Train ticket,-18.00
`;

function Demo() {
  const ledger = useLedger();
  const account = ledger.accounts[0];
  if (!account) return null;
  return (
    <ImportDialog
      account={account}
      transactions={ledger.transactionsByAccount[account.id] ?? []}
      categories={ledger.categories}
      onClose={() => {}}
    />
  );
}

const render = () => (
  <Connected>
    <Demo />
  </Connected>
);

export const ChooseFile: Story = { render };

export const Preview: Story = {
  render,
  play: async ({ canvasElement }) => {
    const input = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
      if (!found) throw new Error('file input not ready');
      return found;
    });
    await userEvent.upload(input, new File([CSV], 'bank-export.csv', { type: 'text/csv' }));
    await within(canvasElement).findByText(/bank-export\.csv/);
  },
};

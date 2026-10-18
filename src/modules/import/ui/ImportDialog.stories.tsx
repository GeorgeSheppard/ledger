import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, waitFor, within } from 'storybook/test';
import { useLedger } from '../../../state/ledgerData';
import { Connected } from '../../../storybook/providers';
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

/** Text copied from a bank's website: navigation, a column header and a balance line included. */
const PASTED = `Your accounts > Current account
Showing 1-5 of 134
Date Description Money out Money in Balance
12 Oct 2026 TESCO STORES 3412 £23.45 £1,204.10
11 Oct 2026 ACME LTD SALARY £2,400.00 £1,227.55
10 Oct 2026 CARD PAYMENT TO PRET A MANGER £4.20 -£1,172.45
09 Oct 2026 NETFLIX.COM £10.99 -£1,168.25
Page 1 of 34`;

export const PasteText: Story = {
  render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: /paste text instead/i }));
    const box = await canvas.findByRole('textbox');
    await userEvent.click(box);
    await userEvent.paste(PASTED);
    await canvas.findByText(/Pasted text/);
  },
};

export const PasteBox: Story = {
  render,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', { name: /paste text instead/i })
    );
    await within(canvasElement).findByRole('textbox');
  },
};

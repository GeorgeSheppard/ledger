import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { Connected } from '../../storybook/providers';
import { PaychecksPage } from './PaychecksPage';

const meta = { title: 'Pages/Paychecks', component: PaychecksPage } satisfies Meta<
  typeof PaychecksPage
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Six payslips, newest first. */
export const Default: Story = {
  render: () => (
    <Connected shell route="/paychecks">
      <PaychecksPage />
    </Connected>
  ),
};

export const Empty: Story = {
  render: () => (
    <Connected shell route="/paychecks" noPaychecks>
      <PaychecksPage />
    </Connected>
  ),
};

/** A blank payslip: a date, income and deductions, with names used before offered as suggestions. */
export const AddPaycheck: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', { name: /^add paycheck/i })
    );
    await within(canvasElement).findByRole('dialog');
  },
};

const OLD_SHEET = [
  'Date\tTax Code\tTax Year\tTotal Income\tPension (Salary Sacrifice)\tPension (Employer)\tTaxable Benefits\tIncome Tax\tNI\tStudent Loan\tDonations\tTake Home',
  '25/08/2026\t1257L\t2026/27\t5,000.00\t250\t400\t120\t700\t300\t150\t50\t3,550.00',
  '25/09/2026\t1257L\t2026/27\t5,000.00\t250\t400\t120\t700\t300\t150\t50\t3,550.00',
].join('\n');

/** Rows pasted from the old sheet, read and ready to add. */
export const ImportOldSheet: Story = {
  ...Empty,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', { name: /^import old sheet/i })
    );
    const dialog = await within(canvasElement).findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('textbox'));
    await userEvent.paste(OLD_SHEET);
  },
};

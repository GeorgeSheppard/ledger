import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { Connected } from '../../storybook/providers';
import { PaychecksPage } from './PaychecksPage';

const meta = { title: 'Pages/Paychecks', component: PaychecksPage } satisfies Meta<
  typeof PaychecksPage
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Six months of payslips, newest first. */
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

/** "Copy last month" opens next month's payslip with last month's lines, ready to adjust. */
export const CopyLastMonth: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', { name: /copy last month/i })
    );
    await within(canvasElement).findByRole('dialog');
  },
};

/** A blank payslip: income and deductions, with names used before offered as suggestions. */
export const AddMonth: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: /^add /i }));
    await within(canvasElement).findByRole('dialog');
  },
};

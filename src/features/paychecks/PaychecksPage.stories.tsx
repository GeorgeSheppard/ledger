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

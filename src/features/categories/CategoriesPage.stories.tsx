import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Connected } from '../../storybook/providers';
import { CategoriesPage } from './CategoriesPage';

const meta = { title: 'Pages/Categories', component: CategoriesPage } satisfies Meta<
  typeof CategoriesPage
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Savings is excluded from calculations; Interest is limited to the Savings account (badge). */
export const Default: Story = {
  render: () => (
    <Connected shell route="/categories">
      <CategoriesPage />
    </Connected>
  ),
};

/** Editing a category: "Available on" chooses all accounts or specific ones. */
export const AccountScope: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Groceries'));
    await userEvent.click(await canvas.findByRole('radio', { name: 'Specific accounts' }));
    await userEvent.click(await canvas.findByRole('checkbox', { name: 'Current account' }));
    await expect(canvas.getByRole('checkbox', { name: 'Current account' })).toBeChecked();
  },
};

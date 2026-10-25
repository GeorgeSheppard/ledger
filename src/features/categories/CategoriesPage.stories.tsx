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

/** The "N transactions" count is a link to those transactions; unused categories show plain text. */
export const TransactionsLink: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = (await canvas.findAllByRole('link', { name: /transactions?$/ }))[0]!;
    await expect(link).toHaveAttribute('href', expect.stringMatching(/^\/transactions\?cat=/));
  },
};

/** Archive lives in a category's editor; archiving hides a category from the list; it reappears under "Archived" with a Restore button. */
export const Archived: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Transport'));
    await userEvent.click(await canvas.findByRole('button', { name: /^Archive/ }));
    const summary = await canvas.findByText('Archived (1)');
    await userEvent.click(summary);
    await expect(canvas.getByRole('button', { name: /^Restore/ })).toBeVisible();
    await expect(
      within(canvas.getByRole('table', { name: 'Archived categories' })).getByText('Transport')
    ).toBeVisible();
  },
};

/** Migrate (in the editor) asks where the transactions go and says how many will change before anything happens. */
export const Migrate: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Eating out'));
    await userEvent.click(await canvas.findByRole('button', { name: /^Migrate/ }));
    const picker = await canvas.findByRole('combobox', { name: 'Move to category' });
    await userEvent.click(picker);
    await userEvent.click(await within(document.body).findByRole('option', { name: 'Groceries' }));
    await expect(
      await canvas.findByText(/will change from “Eating out” to “Groceries”/)
    ).toBeVisible();
    await expect(
      canvas.getByRole('checkbox', { name: /Archive “Eating out” afterwards/ })
    ).toBeChecked();
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { Connected } from '../../storybook/providers';
import { DashboardPage } from './DashboardPage';

const meta = {
  title: 'Pages/Dashboard',
  component: DashboardPage,
} satisfies Meta<typeof DashboardPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The latest month, every account, every category. */
export const Default: Story = {
  render: () => (
    <Connected shell>
      <DashboardPage />
    </Connected>
  ),
};

/** One account switched off in the balances legend; every graph follows. */
export const AccountSwitchedOff: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const legend = await within(canvasElement).findAllByRole('button', { pressed: true });
    const account = legend.find((b) => b.textContent === 'Savings');
    if (account) await userEvent.click(account);
  },
};

/** A category picked in the breakdown; every graph is narrowed to it. */
export const CategoryPicked: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const rows = await within(canvasElement).findAllByRole('button', { pressed: true });
    const category = rows.find((b) => b.textContent === 'Groceries');
    if (category) await userEvent.click(category);
  },
};

/** The date picker open, with its presets and the two date fields. */
export const DatePicker: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', { name: /choose dates/i })
    );
  },
};

/** All time: the dates cross years, so the axis labels say which year each month is in. */
export const AllTime: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await userEvent.click(await page.findByRole('button', { name: /choose dates/i }));
    await userEvent.click(await page.findByRole('button', { name: 'All time' }));
    await page.findByRole('button', { name: /choose dates, now Jan/i });
  },
};

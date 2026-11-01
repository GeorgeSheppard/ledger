import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Connected } from '../../storybook/providers';
import { DashboardPage } from './DashboardPage';

const meta = {
  title: 'Pages/Dashboard',
  component: DashboardPage,
} satisfies Meta<typeof DashboardPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The last six months, every account, every category. */
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

/**
 * Double-clicking a balances legend entry (every account starting on) shows just that account. The
 * first click filters, which must not shift the page or the second click would miss the entry.
 */
export const OneAccountOnly: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.dblClick(await canvas.findByRole('button', { name: 'Savings' }));
    await expect(canvas.getByRole('button', { name: 'Savings' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(canvas.getByRole('button', { name: 'Current account' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
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

/** After zooming from a month out to a year, "Back" returns to the month (filters untouched). */
export const BackEnabled: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement);
    await userEvent.click(await screen.findByRole('button', { name: /choose dates/i }));
    await userEvent.click(
      await within(document.body).findByRole('button', { name: 'Last 12 months' })
    );
    await userEvent.keyboard('{Escape}');
  },
};

/** A spending node clicked in the Sankey: it is outlined, the other spending is dimmed, and the other graphs follow. */
export const SankeyCategoryClicked: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const node = await within(canvasElement).findByRole('button', { name: /^Groceries: / });
    await userEvent.click(node);
  },
};

/** Hovering a small spending node: its amount shows in the line above the Sankey, not a tooltip. */
export const SankeyHovered: Story = {
  render: Default.render,
  play: async ({ canvasElement }) => {
    const node = await within(canvasElement).findByRole('button', { name: /^Bills: / });
    await userEvent.hover(node.querySelector('rect')!);
  },
};

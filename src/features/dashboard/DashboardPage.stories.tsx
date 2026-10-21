import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import type { DashboardConfig } from '../../lib/dashboard/config';
import { createWidget, GRAPHS } from '../../modules/graphs';
import { Connected } from '../../storybook/providers';
import { DashboardPage } from './DashboardPage';

const meta = {
  title: 'Pages/Dashboard',
  component: DashboardPage,
} satisfies Meta<typeof DashboardPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** One widget of every kind, so each graph type can be reviewed together. */
const everyGraph: DashboardConfig = {
  widgets: GRAPHS.map((graph, i) => createWidget(graph.kind, `w${i + 1}`)),
};

function only(kind: string): DashboardConfig {
  return { widgets: [createWidget(kind, 'w1', { width: 4 })] };
}

/** The layout a new spreadsheet starts with. */
export const Default: Story = {
  render: () => (
    <Connected shell>
      <DashboardPage />
    </Connected>
  ),
};

export const EveryGraphType: Story = {
  render: () => (
    <Connected shell dashboard={everyGraph}>
      <DashboardPage />
    </Connected>
  ),
};

export const Sankey: Story = {
  render: () => (
    <Connected shell dashboard={only('sankey')}>
      <DashboardPage />
    </Connected>
  ),
};

export const NetWorth: Story = {
  render: () => (
    <Connected shell dashboard={only('netWorth')}>
      <DashboardPage />
    </Connected>
  ),
};

export const SpendingByCategory: Story = {
  render: () => (
    <Connected shell dashboard={only('spending')}>
      <DashboardPage />
    </Connected>
  ),
};

export const CashFlow: Story = {
  render: () => (
    <Connected shell dashboard={only('cashFlow')}>
      <DashboardPage />
    </Connected>
  ),
};

/** The default layout with one headline number clicked open as a graph. */
function statOpened(label: RegExp): Story {
  return {
    render: Default.render,
    play: async ({ canvasElement }) => {
      const tile = await within(canvasElement).findByRole('button', { name: label });
      await userEvent.click(tile);
      await within(canvasElement).findByRole('dialog');
    },
  };
}

/** Share of income saved over time, with "View transactions". */
export const SavingsRateOpened = statOpened(/share of income saved/i);

/** Spending over time, with "View transactions" for money out. */
export const SpendingOpened = statOpened(/^spending in the latest month/i);

/** Net worth is a total, so there is no "View transactions". */
export const NetWorthOpened = statOpened(/^net worth/i);

/** A 3 month range only picks the window shown first; the chart can still be dragged back to April. */
export const NetWorthThreeMonths: Story = {
  render: () => (
    <Connected
      shell
      dashboard={{ widgets: [createWidget('netWorth', 'w1', { width: 4, range: 3 })] }}
    >
      <DashboardPage />
    </Connected>
  ),
};

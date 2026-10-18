import type { Meta, StoryObj } from '@storybook/react-vite';
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

import type { Meta, StoryObj } from '@storybook/react-vite';
import { newWidget, WIDGET_KINDS, type DashboardConfig } from '../../lib/dashboard/config';
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
  widgets: WIDGET_KINDS.map((kind, i) => newWidget(kind, `w${i + 1}`)),
};

function only(kind: (typeof WIDGET_KINDS)[number]): DashboardConfig {
  return { widgets: [newWidget(kind, 'w1', { width: 4 })] };
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

import { newWidget, type DashboardConfig, type Widget } from '../../lib/dashboard/config';
import { balancesGraph } from './balances';
import { breakdownGraph } from './breakdown';
import { cashFlowGraph } from './cash-flow';
import { netWorthGraph } from './net-worth';
import { sankeyGraph } from './sankey';
import { spendingGraph } from './spending';
import { statGraph } from './stat';
import type { Graph } from './types';

export type { Graph, GraphOptionsProps, GraphViewProps } from './types';

/**
 * Every graph the dashboard can show, in the order the editor lists them. To add a graph, build a
 * folder next to the others that exports a `Graph` and add it here; to remove one, delete its
 * folder and its line. Layouts that still mention a removed graph skip it.
 */
export const GRAPHS: readonly Graph[] = [
  statGraph,
  netWorthGraph,
  balancesGraph,
  spendingGraph,
  breakdownGraph,
  cashFlowGraph,
  sankeyGraph,
];

export function graphOf(kind: string): Graph | undefined {
  return GRAPHS.find((g) => g.kind === kind);
}

/** The title shown above a widget: its own, else its graph's default. */
export function widgetTitle(widget: Widget): string {
  if (widget.title.trim()) return widget.title.trim();
  return graphOf(widget.kind)?.title(widget) ?? 'Unknown graph';
}

/** A widget of `kind` with its graph's default width and settings. */
export function createWidget(kind: string, id: string, overrides: Partial<Widget> = {}): Widget {
  const graph = graphOf(kind);
  return newWidget(kind, id, {
    ...(graph && { width: graph.defaultWidth, ...graph.defaults }),
    ...overrides,
  });
}

/** The layout used until the user changes it: headline numbers, then the main charts. */
export function defaultDashboard(): DashboardConfig {
  const layout: [string, Partial<Widget>?][] = [
    ['stat', { metric: 'netWorth' }],
    ['stat', { metric: 'spending' }],
    ['stat', { metric: 'income' }],
    ['stat', { metric: 'savingsRate' }],
    ['netWorth'],
    ['balances'],
    ['spending'],
    ['breakdown'],
    ['cashFlow'],
  ];
  return {
    widgets: layout.map(([kind, overrides], i) => createWidget(kind, `w${i + 1}`, overrides)),
  };
}

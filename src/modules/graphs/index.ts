import { accountsGraph } from './accounts';
import { breakdownGraph } from './breakdown';
import { cashFlowGraph } from './cash-flow';
import { sankeyGraph } from './sankey';
import { spendingGraph } from './spending';
import type { Graph } from './types';

export { PaycheckFlow } from './sankey/PaycheckFlow';
export type { Graph, GraphViewProps } from './types';

/**
 * Every graph the dashboard shows, in order. To add a graph, build a folder next to the others that
 * exports a `Graph` and add it here; to remove one, delete its folder and its line.
 */
export const GRAPHS: readonly Graph[] = [
  accountsGraph,
  spendingGraph,
  breakdownGraph,
  cashFlowGraph,
  sankeyGraph,
];

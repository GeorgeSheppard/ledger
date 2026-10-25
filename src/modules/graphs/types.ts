import type { ComponentType } from 'react';
import type { WidgetWidth } from '../../lib/dashboard/config';
import type { Period } from '../../lib/metrics/period';
import type { AccountLedger } from '../../lib/metrics/netWorth';
import type { Paycheck } from '../../lib/paychecks/paychecks';

/**
 * What every graph is given to draw. The dashboard page works all of this out once: the one date
 * range, and the account and category filters that every graph shares.
 */
export interface GraphViewProps {
  /** The date range every graph is drawn for. */
  period: Period;
  /** Every account, so graphs can match transfers and list accounts that are switched off. */
  ledgers: AccountLedger[];
  paychecks: Paycheck[];
  /** Accounts switched on in the balances legend. Graphs draw only these. */
  accountIds: number[];
  /** Categories picked by clicking one; empty means all of them. */
  categories: string[];
  /** Lower-cased names of categories the user excluded; income and spending must skip them. */
  ignoredCategories: ReadonlySet<string>;
  colorOf(category: string): string;
  accountColorOf(accountId: number): string;
  toggleAccount(accountId: number): void;
  toggleCategory(category: string): void;
  /** Sets the dashboard's date range, e.g. from dragging across a graph. */
  selectPeriod(period: Period): void;
}

/**
 * One graph of the dashboard. A graph lives in its own folder under `src/modules/graphs`, exports
 * one of these from its `index.tsx`, and is registered in `./index.ts`. Nothing else knows it exists.
 */
export interface Graph {
  readonly kind: string;
  /** Shown above the graph. */
  readonly title: string;
  /** Columns of the dashboard's 4-column grid on wide screens. */
  readonly width: WidgetWidth;
  readonly View: ComponentType<GraphViewProps>;
}

import type { ComponentType } from 'react';
import type { Widget, WidgetWidth } from '../../lib/dashboard/config';
import type { Dashboard, DashboardRange } from '../../lib/metrics/dashboard';
import type { MonthKey } from '../../lib/metrics/months';
import type { AccountLedger } from '../../lib/metrics/netWorth';
import type { Paycheck } from '../../lib/paychecks/paychecks';

/** What every graph is given to draw. The dashboard page works all of this out once per widget. */
export interface GraphViewProps {
  widget: Widget;
  /** The widget's range and accounts applied; null when those accounts have no transactions. */
  dashboard: Dashboard | null;
  ledgers: AccountLedger[];
  paychecks: Paycheck[];
  /** The widget's own range, or the page's when the widget follows it. */
  range: DashboardRange;
  /** Accounts the widget covers, with deleted ones dropped. */
  accountIds: number[];
  /** Lower-cased names of categories the user excluded; income and spending must skip them. */
  ignoredCategories: ReadonlySet<string>;
  colorOf(category: string): string;
  /** The month picked on a spending chart, shared by every graph that shows one month. Falls back to the latest. */
  month: MonthKey | null;
  onSelectMonth(month: MonthKey): void;
  /** Month stepping shortcuts are off while the layout is being edited. */
  interactive: boolean;
}

export interface GraphOptionsProps {
  widget: Widget;
  onChange(patch: Partial<Widget>): void;
}

/**
 * One kind of dashboard graph. A graph lives in its own folder under `src/modules/graphs`, exports
 * one of these from its `index.tsx`, and is registered in `./index.ts`. Nothing else knows it exists.
 */
export interface Graph {
  /** Stored in the spreadsheet's dashboard layout, so never rename it once released. */
  readonly kind: string;
  /** Shown in the "Show" picker. */
  readonly label: string;
  readonly defaultWidth: WidgetWidth;
  /** Fields of a new widget of this kind beyond the common defaults. */
  readonly defaults?: Partial<Widget>;
  /** Whether the editor offers narrowing to some spending categories. */
  readonly usesCategories?: boolean;
  /** The title shown when the widget has none of its own. */
  title(widget: Widget): string;
  /** Extra settings only this graph has, shown in the editor under "Show". */
  readonly Options?: ComponentType<GraphOptionsProps>;
  readonly View: ComponentType<GraphViewProps>;
}

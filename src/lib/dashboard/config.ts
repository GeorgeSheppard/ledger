import type { DashboardRange } from '../metrics/dashboard';

/**
 * The dashboard layout: an ordered list of widgets laid out left to right on a 4-column grid,
 * wrapping onto new rows. Saved in the spreadsheet's `_Dashboard` tab (see `./sheetFormat.ts`), so
 * it follows the sheet rather than the browser. Plain data and pure functions only.
 */

export const WIDGET_KINDS = [
  'stat',
  'netWorth',
  'balances',
  'spending',
  'breakdown',
  'cashFlow',
  'sankey',
] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export const STAT_METRICS = [
  'netWorth',
  'spending',
  'income',
  'savingsRate',
  'averageSpending',
] as const;
export type StatMetric = (typeof STAT_METRICS)[number];

/** Columns of the 4-column grid a widget spans on wide screens. Small screens stack everything. */
export type WidgetWidth = 1 | 2 | 3 | 4;
export const MIN_WIDTH: WidgetWidth = 1;
export const MAX_WIDTH: WidgetWidth = 4;

export const RANGES: readonly DashboardRange[] = [3, 6, 12, 'all'];

export interface Widget {
  /** Unique within the dashboard. */
  id: string;
  kind: WidgetKind;
  /** Shown above the widget. Empty means the kind's default title. */
  title: string;
  /** Account (tab) ids to include. Empty means every account, including ones added later. */
  accounts: number[];
  /** Spending categories to show (spending and breakdown widgets). Empty means all. */
  categories: string[];
  /** Months covered. `null` follows the range picked at the top of the dashboard. */
  range: DashboardRange | null;
  width: WidgetWidth;
  /** Which number a `stat` widget shows. Ignored by other kinds. */
  metric: StatMetric;
}

export interface DashboardConfig {
  widgets: Widget[];
}

export const KIND_LABELS: Record<WidgetKind, string> = {
  stat: 'Single number',
  netWorth: 'Net worth over time',
  balances: 'Account balances',
  spending: 'Spending by category, per month',
  breakdown: 'Category breakdown for a month',
  cashFlow: 'Income and spending',
  sankey: 'Money flow from paychecks (Sankey)',
};

export const METRIC_LABELS: Record<StatMetric, string> = {
  netWorth: 'Net worth',
  spending: 'Spending in the latest month',
  income: 'Income in the latest month',
  savingsRate: 'Share of income saved',
  averageSpending: 'Average monthly spending',
};

/** Which widget kinds can be narrowed to some categories. */
export function usesCategories(kind: WidgetKind): boolean {
  return kind === 'spending' || kind === 'breakdown';
}

const DEFAULT_WIDTHS: Record<WidgetKind, WidgetWidth> = {
  stat: 1,
  netWorth: 3,
  balances: 1,
  spending: 4,
  breakdown: 2,
  cashFlow: 2,
  sankey: 4,
};

/** The title shown when a widget has none of its own. */
export function widgetTitle(widget: Pick<Widget, 'kind' | 'title' | 'metric'>): string {
  if (widget.title.trim()) return widget.title.trim();
  if (widget.kind === 'stat') return METRIC_LABELS[widget.metric];
  if (widget.kind === 'netWorth') return 'Net worth';
  if (widget.kind === 'balances') return 'Accounts';
  if (widget.kind === 'spending') return 'Spending by category';
  if (widget.kind === 'breakdown') return 'Category breakdown';
  if (widget.kind === 'sankey') return 'Where your money goes';
  return 'Income and spending';
}

/** An id not used by any of `existing`. */
export function newWidgetId(existing: readonly Pick<Widget, 'id'>[]): string {
  const used = new Set(existing.map((w) => w.id));
  for (let n = existing.length + 1; ; n++) if (!used.has(`w${n}`)) return `w${n}`;
}

/** A widget of `kind` with sensible defaults: every account, every category, the page's range. */
export function newWidget(kind: WidgetKind, id: string, overrides: Partial<Widget> = {}): Widget {
  return {
    id,
    kind,
    title: '',
    accounts: [],
    categories: [],
    range: null,
    width: DEFAULT_WIDTHS[kind],
    metric: 'netWorth',
    ...overrides,
  };
}

/** The layout used until the user changes it: headline numbers, then the main charts. */
export function defaultDashboard(): DashboardConfig {
  const kinds: [WidgetKind, Partial<Widget>?][] = [
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
  return { widgets: kinds.map(([kind, overrides], i) => newWidget(kind, `w${i + 1}`, overrides)) };
}

export function addWidget(config: DashboardConfig, widget: Widget): DashboardConfig {
  return { widgets: [...config.widgets, widget] };
}

export function replaceWidget(config: DashboardConfig, widget: Widget): DashboardConfig {
  return { widgets: config.widgets.map((w) => (w.id === widget.id ? widget : w)) };
}

export function removeWidget(config: DashboardConfig, id: string): DashboardConfig {
  return { widgets: config.widgets.filter((w) => w.id !== id) };
}

/** Moves a widget `by` places in the layout (negative is earlier), stopping at either end. */
export function moveWidget(config: DashboardConfig, id: string, by: number): DashboardConfig {
  const from = config.widgets.findIndex((w) => w.id === id);
  if (from < 0) return config;
  const to = Math.max(0, Math.min(config.widgets.length - 1, from + by));
  const widgets = [...config.widgets];
  const [widget] = widgets.splice(from, 1);
  widgets.splice(to, 0, widget!);
  return { widgets };
}

/** Makes a widget `by` columns wider (negative is narrower), within 1–4. */
export function resizeWidget(config: DashboardConfig, id: string, by: number): DashboardConfig {
  return {
    widgets: config.widgets.map((w) =>
      w.id === id ? { ...w, width: clampWidth(w.width + by) } : w
    ),
  };
}

export function clampWidth(width: number): WidgetWidth {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width))) as WidgetWidth;
}

/**
 * The accounts a widget covers, given the accounts that exist now. Ids of deleted accounts are
 * dropped; if none are left the widget falls back to every account rather than showing nothing.
 */
export function widgetAccountIds(widget: Widget, accountIds: readonly number[]): number[] {
  const kept = widget.accounts.filter((id) => accountIds.includes(id));
  return kept.length ? kept : [...accountIds];
}

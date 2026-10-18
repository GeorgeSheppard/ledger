import type { DashboardRange } from '../metrics/dashboard';
import {
  clampWidth,
  newWidget,
  STAT_METRICS,
  WIDGET_KINDS,
  type DashboardConfig,
  type StatMetric,
  type Widget,
  type WidgetKind,
} from './config';

/**
 * The dashboard layout as stored in the spreadsheet (the store keeps it as JSON in the
 * `_Dashboard` tab). Reading is forgiving because the sheet can be edited by hand: anything that
 * cannot be understood is dropped or replaced with its default instead of failing the dashboard.
 */

export const DASHBOARD_FORMAT_VERSION = 1;

/** The stored shape. Plain JSON: arrays, strings, numbers and null only. */
export interface StoredDashboard {
  version: number;
  widgets: {
    id: string;
    kind: WidgetKind;
    title: string;
    accounts: number[];
    categories: string[];
    range: DashboardRange | null;
    width: number;
    metric: StatMetric;
  }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKind(value: unknown): value is WidgetKind {
  return (WIDGET_KINDS as readonly unknown[]).includes(value);
}

function isMetric(value: unknown): value is StatMetric {
  return (STAT_METRICS as readonly unknown[]).includes(value);
}

function parseRange(value: unknown): DashboardRange | null {
  if (value === 'all') return 'all';
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function arrayOf<T>(value: unknown, keep: (item: unknown) => item is T): T[] {
  return Array.isArray(value) ? value.filter(keep) : [];
}

const isAccountId = (item: unknown): item is number => Number.isInteger(item);
const isName = (item: unknown): item is string => typeof item === 'string' && item.trim() !== '';

/** One stored widget, or null when its id or kind is missing or unknown. */
export function parseWidget(value: unknown): Widget | null {
  if (!isRecord(value)) return null;
  const { id, kind } = value;
  if (typeof id !== 'string' || !id || !isKind(kind)) return null;
  return newWidget(kind, id, {
    title: typeof value.title === 'string' ? value.title : '',
    accounts: arrayOf(value.accounts, isAccountId),
    categories: arrayOf(value.categories, isName),
    range: parseRange(value.range),
    ...(typeof value.width === 'number' && Number.isFinite(value.width)
      ? { width: clampWidth(value.width) }
      : {}),
    ...(isMetric(value.metric) ? { metric: value.metric } : {}),
  });
}

/**
 * The stored layout, or null when there is none (or it is unreadable), so the caller can use the
 * default layout. A stored layout with no widgets is a deliberately empty dashboard.
 */
export function parseDashboard(value: unknown): DashboardConfig | null {
  if (!isRecord(value) || !Array.isArray(value.widgets)) return null;
  const seen = new Set<string>();
  const widgets: Widget[] = [];
  for (const item of value.widgets) {
    const widget = parseWidget(item);
    if (!widget || seen.has(widget.id)) continue;
    seen.add(widget.id);
    widgets.push(widget);
  }
  return { widgets };
}

export function serializeDashboard(config: DashboardConfig): StoredDashboard {
  return {
    version: DASHBOARD_FORMAT_VERSION,
    widgets: config.widgets.map((w) => ({
      id: w.id,
      kind: w.kind,
      title: w.title,
      accounts: [...w.accounts],
      categories: [...w.categories],
      range: w.range,
      width: w.width,
      metric: w.metric,
    })),
  };
}

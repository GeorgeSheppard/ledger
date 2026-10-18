import { z } from 'zod';
import { clampWidth, newWidget, type DashboardConfig, type Widget } from './config';

/**
 * The dashboard layout as stored in the spreadsheet (the store keeps it as JSON in the
 * `_Dashboard` tab). Reading is forgiving because the sheet can be edited by hand: anything that
 * cannot be understood is dropped or replaced with its default instead of failing the dashboard.
 */

export const DASHBOARD_FORMAT_VERSION = 1;

/** A field that falls back to `fallback` when it is missing or the wrong type. */
const lenient = <S extends z.ZodType>(schema: S, fallback: z.infer<S>) => schema.catch(fallback);

/** Any named kind is kept, so a layout survives a graph being removed and added back later. */
const kindSchema = z.string().refine((kind) => kind.trim() !== '');
const rangeSchema = z.union([z.literal('all'), z.number().int().positive()]);

const storedWidgetSchema = z.object({
  id: z.string().min(1),
  kind: kindSchema,
  title: lenient(z.string(), ''),
  accounts: lenient(
    z.array(z.unknown()).transform((items) => items.filter((i) => Number.isInteger(i)) as number[]),
    []
  ),
  categories: lenient(
    z
      .array(z.unknown())
      .transform((items) =>
        items.filter((i): i is string => typeof i === 'string' && i.trim() !== '')
      ),
    []
  ),
  range: rangeSchema.nullable().catch(null),
  width: z.number().finite().optional().catch(undefined),
  metric: z.string().optional().catch(undefined),
});

/** The stored shape. Plain JSON: arrays, strings, numbers and null only. */
export type StoredDashboard = {
  version: number;
  widgets: {
    id: string;
    kind: string;
    title: string;
    accounts: number[];
    categories: string[];
    range: 'all' | number | null;
    width: number;
    metric: string;
  }[];
};

/** One stored widget, or null when its id or kind is missing or unknown. */
export function parseWidget(value: unknown): Widget | null {
  const parsed = storedWidgetSchema.safeParse(value);
  if (!parsed.success) return null;
  const { id, kind, title, accounts, categories, range, width, metric } = parsed.data;
  return newWidget(kind, id, {
    title,
    accounts,
    categories,
    range,
    ...(width === undefined ? {} : { width: clampWidth(width) }),
    ...(metric === undefined ? {} : { metric }),
  });
}

const storedDashboardSchema = z.object({ widgets: z.array(z.unknown()) });

/**
 * The stored layout, or null when there is none (or it is unreadable), so the caller can use the
 * default layout. A stored layout with no widgets is a deliberately empty dashboard.
 */
export function parseDashboard(value: unknown): DashboardConfig | null {
  const parsed = storedDashboardSchema.safeParse(value);
  if (!parsed.success) return null;
  const seen = new Set<string>();
  const widgets: Widget[] = [];
  for (const item of parsed.data.widgets) {
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

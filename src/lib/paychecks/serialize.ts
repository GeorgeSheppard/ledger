import { z } from 'zod';
import { todayIso } from '../transactions/dates';
import { migrateLegacyPaychecks } from './legacy';
import type { PayLine, Paycheck, PaycheckList } from './paychecks';

/**
 * Paychecks as stored in the spreadsheet (the store keeps them as JSON in the `_Paychecks` tab).
 * Reading is forgiving because the sheet can be edited by hand: anything that cannot be understood
 * is dropped or repaired instead of failing the page. Version 1 (a schedule per paycheck) is
 * converted to per-month entries on read and written back as version 2 with the next save.
 */

export const PAYCHECKS_FORMAT_VERSION = 2;

/** The stored shape. Plain JSON: arrays, strings and numbers only. */
export interface StoredPaychecks {
  version: number;
  paychecks: Paycheck[];
}

const storedLineSchema = z.object({
  id: z.string().optional().catch(undefined),
  name: z.string(),
  amount: z.number().finite().min(0),
});

/** Lines that are not understood are dropped; missing or repeated ids are repaired. */
function parseLines(value: unknown): PayLine[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const lines: PayLine[] = [];
  value.forEach((item, i) => {
    const parsed = storedLineSchema.safeParse(item);
    if (!parsed.success) return;
    let id = parsed.data.id || `l${i + 1}`;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);
    lines.push({ id, name: parsed.data.name, amount: parsed.data.amount });
  });
  return lines;
}

const storedPaycheckSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  income: z.unknown().optional().transform(parseLines),
  deductions: z.unknown().optional().transform(parseLines),
});

/** One stored paycheck, or null when it has no valid month. */
export function parsePaycheck(value: unknown): Paycheck | null {
  const parsed = storedPaycheckSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const storedListSchema = z.object({
  version: z.number().optional().catch(undefined),
  paychecks: z.array(z.unknown()),
});

/**
 * The stored list, or an empty one when there is none (or it is unreadable). `today` only matters
 * for version 1 data, whose open-ended schedules are carried up to this month.
 */
export function parsePaychecks(value: unknown, today = todayIso()): PaycheckList {
  const parsed = storedListSchema.safeParse(value);
  if (!parsed.success) return { paychecks: [] };
  if ((parsed.data.version ?? 1) < 2)
    return { paychecks: migrateLegacyPaychecks(parsed.data.paychecks, today) };
  const byMonth = new Map<string, Paycheck>();
  for (const item of parsed.data.paychecks) {
    const paycheck = parsePaycheck(item);
    if (paycheck && !byMonth.has(paycheck.month)) byMonth.set(paycheck.month, paycheck);
  }
  return { paychecks: [...byMonth.values()].sort((a, b) => (a.month < b.month ? -1 : 1)) };
}

export function serializePaychecks(list: PaycheckList): StoredPaychecks {
  const line = (l: PayLine) => ({ id: l.id, name: l.name, amount: l.amount });
  return {
    version: PAYCHECKS_FORMAT_VERSION,
    paychecks: list.paychecks.map((p) => ({
      month: p.month,
      income: p.income.map(line),
      deductions: p.deductions.map(line),
    })),
  };
}

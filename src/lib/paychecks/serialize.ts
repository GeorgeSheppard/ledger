import { z } from 'zod';
import { isoDateSchema } from '../domain/schemas';
import { todayIso } from '../transactions/dates';
import { migrateMonthlyPaychecks, migrateScheduledPaychecks } from './legacy';
import { newId, type PayLine, type Paycheck, type PaycheckList } from './paychecks';

/**
 * Paychecks as stored in the spreadsheet (the store keeps them as JSON in the `_Paychecks` tab).
 * Reading is forgiving because the sheet can be edited by hand: anything that cannot be understood
 * is dropped or repaired instead of failing the page. Versions 1 (a schedule per paycheck) and 2
 * (one payslip per month) are converted to dated paychecks on read and written back as version 3
 * with the next save.
 */

export const PAYCHECKS_FORMAT_VERSION = 3;

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
  id: z.string().optional().catch(undefined),
  date: isoDateSchema,
  income: z.unknown().optional().transform(parseLines),
  benefits: z.unknown().optional().transform(parseLines),
  deductions: z.unknown().optional().transform(parseLines),
});

const storedListSchema = z.object({
  version: z.number().optional().catch(undefined),
  paychecks: z.array(z.unknown()),
});

const byDate = (a: Paycheck, b: Paycheck) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

type Loose = Omit<Paycheck, 'id'> & { id?: string | undefined };

/** Gives every paycheck a unique id (keeping the ones it has) and puts them oldest first. */
function withIds(paychecks: readonly Loose[]): Paycheck[] {
  const result: Paycheck[] = [];
  for (const p of paychecks) {
    const id = p.id && !result.some((r) => r.id === p.id) ? p.id : newId(result, 'p');
    result.push({ ...p, id });
  }
  return result.sort(byDate);
}

/**
 * The stored list, or an empty one when there is none (or it is unreadable). `today` only matters
 * for version 1 data, whose open-ended schedules are carried up to today.
 */
export function parsePaychecks(value: unknown, today = todayIso()): PaycheckList {
  const parsed = storedListSchema.safeParse(value);
  if (!parsed.success) return { paychecks: [] };
  const version = parsed.data.version ?? 1;
  if (version < 2)
    return { paychecks: withIds(migrateScheduledPaychecks(parsed.data.paychecks, today)) };
  if (version < 3) return { paychecks: withIds(migrateMonthlyPaychecks(parsed.data.paychecks)) };
  const read: Loose[] = [];
  for (const item of parsed.data.paychecks) {
    const paycheck = storedPaycheckSchema.safeParse(item);
    if (paycheck.success) read.push(paycheck.data);
  }
  return { paychecks: withIds(read) };
}

export function serializePaychecks(list: PaycheckList): StoredPaychecks {
  const line = (l: PayLine) => ({ id: l.id, name: l.name, amount: l.amount });
  return {
    version: PAYCHECKS_FORMAT_VERSION,
    paychecks: list.paychecks.map((p) => ({
      id: p.id,
      date: p.date,
      income: p.income.map(line),
      benefits: p.benefits.map(line),
      deductions: p.deductions.map(line),
    })),
  };
}

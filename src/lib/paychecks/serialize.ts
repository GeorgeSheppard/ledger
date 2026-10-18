import { z } from 'zod';
import { isoDateSchema } from '../domain/schemas';
import { REPEATS, type Deduction, type Paycheck, type PaycheckList } from './paychecks';

/**
 * Paychecks as stored in the spreadsheet (the store keeps them as JSON in the `_Paychecks` tab).
 * Reading is forgiving because the sheet can be edited by hand: anything that cannot be understood
 * is dropped or repaired instead of failing the page.
 */

export const PAYCHECKS_FORMAT_VERSION = 1;

/** The stored shape. Plain JSON: arrays, strings, numbers and null only. */
export interface StoredPaychecks {
  version: number;
  paychecks: Paycheck[];
}

const moneySchema = z.number().finite().min(0);

const storedDeductionSchema = z.object({
  id: z.string().optional().catch(undefined),
  name: z.string(),
  amount: moneySchema,
});

/** Deductions that are not understood are dropped; missing or repeated ids are repaired. */
function parseDeductions(value: unknown): Deduction[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const deductions: Deduction[] = [];
  value.forEach((item, i) => {
    const parsed = storedDeductionSchema.safeParse(item);
    if (!parsed.success) return;
    let id = parsed.data.id || `d${i + 1}`;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);
    deductions.push({ id, name: parsed.data.name, amount: parsed.data.amount });
  });
  return deductions;
}

const storedPaycheckSchema = z.object({
  id: z.string().min(1),
  name: z.string().catch(''),
  date: isoDateSchema,
  gross: moneySchema.refine((gross) => gross > 0),
  deductions: z.unknown().transform(parseDeductions),
  accountId: z.number().int().nullable().catch(null),
  repeat: z.enum(REPEATS).catch('none'),
  until: isoDateSchema.nullable().catch(null),
});

/** One stored paycheck, or null when it has no id, a bad date or no positive gross pay. */
export function parsePaycheck(value: unknown): Paycheck | null {
  const parsed = storedPaycheckSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const storedListSchema = z.object({ paychecks: z.array(z.unknown()) });

/** The stored list, or an empty one when there is none (or it is unreadable). */
export function parsePaychecks(value: unknown): PaycheckList {
  const parsed = storedListSchema.safeParse(value);
  if (!parsed.success) return { paychecks: [] };
  const seen = new Set<string>();
  const paychecks: Paycheck[] = [];
  for (const item of parsed.data.paychecks) {
    const paycheck = parsePaycheck(item);
    if (!paycheck || seen.has(paycheck.id)) continue;
    seen.add(paycheck.id);
    paychecks.push(paycheck);
  }
  return { paychecks };
}

export function serializePaychecks(list: PaycheckList): StoredPaychecks {
  return {
    version: PAYCHECKS_FORMAT_VERSION,
    paychecks: list.paychecks.map((p) => ({
      id: p.id,
      name: p.name,
      date: p.date,
      gross: p.gross,
      deductions: p.deductions.map((d) => ({ id: d.id, name: d.name, amount: d.amount })),
      accountId: p.accountId,
      repeat: p.repeat,
      until: p.until,
    })),
  };
}

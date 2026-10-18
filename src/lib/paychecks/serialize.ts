import { isIsoDate } from '../transactions/dates';
import {
  REPEATS,
  type Deduction,
  type Paycheck,
  type PaycheckList,
  type Repeat,
} from './paychecks';

/**
 * Paychecks as stored in the spreadsheet (the store keeps them as JSON in the `_Paychecks` tab).
 * Reading is forgiving because the sheet can be edited by hand: anything that cannot be understood
 * is dropped or repaired instead of failing the page.
 */

export const PAYCHECKS_FORMAT_VERSION = 1;

/** The stored shape. Plain JSON: arrays, strings, numbers and null only. */
export interface StoredPaychecks {
  version: number;
  paychecks: {
    id: string;
    name: string;
    date: string;
    gross: number;
    deductions: { id: string; name: string; amount: number }[];
    accountId: number | null;
    repeat: Repeat;
    until: string | null;
  }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isMoney = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function parseDeductions(value: unknown): Deduction[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const deductions: Deduction[] = [];
  value.forEach((item, i) => {
    if (!isRecord(item) || typeof item.name !== 'string' || !isMoney(item.amount)) return;
    let id = typeof item.id === 'string' && item.id ? item.id : `d${i + 1}`;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);
    deductions.push({ id, name: item.name, amount: item.amount });
  });
  return deductions;
}

/** One stored paycheck, or null when it has no id, a bad date or no positive gross pay. */
export function parsePaycheck(value: unknown): Paycheck | null {
  if (!isRecord(value)) return null;
  const { id, date, gross } = value;
  if (typeof id !== 'string' || !id) return null;
  if (typeof date !== 'string' || !isIsoDate(date)) return null;
  if (!isMoney(gross) || gross === 0) return null;
  return {
    id,
    name: typeof value.name === 'string' ? value.name : '',
    date,
    gross,
    deductions: parseDeductions(value.deductions),
    accountId: Number.isInteger(value.accountId) ? (value.accountId as number) : null,
    repeat: (REPEATS as readonly unknown[]).includes(value.repeat)
      ? (value.repeat as Repeat)
      : 'none',
    until: typeof value.until === 'string' && isIsoDate(value.until) ? value.until : null,
  };
}

/** The stored list, or an empty one when there is none (or it is unreadable). */
export function parsePaychecks(value: unknown): PaycheckList {
  if (!isRecord(value) || !Array.isArray(value.paychecks)) return { paychecks: [] };
  const seen = new Set<string>();
  const paychecks: Paycheck[] = [];
  for (const item of value.paychecks) {
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

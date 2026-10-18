import type { Transaction } from '../domain/types';
import { monthOf, type MonthKey } from './months';

/** Label used for transactions with no category. */
export const UNCATEGORISED = 'Uncategorised';

/** Income and spending over one period: a month, week or day. */
export interface PeriodCashFlow {
  /** Money in, as a positive number. */
  income: number;
  /** Money out, as a positive number. */
  spending: number;
  /** income - spending. */
  net: number;
  /** Net spend per category (positive numbers), only categories that were net outgoing. */
  spendingByCategory: Record<string, number>;
  /** Net income per category (positive numbers), only categories that were net incoming. */
  incomeByCategory: Record<string, number>;
}

export interface MonthCashFlow extends PeriodCashFlow {
  month: MonthKey;
}

function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Income and spending for each of `keys` (periods in order), where `keyOf` says which period a
 * date belongs to. Amounts are netted per category first, so a refund reduces that category's
 * spending instead of counting as income. Transactions in `excluded` (transfers, opening
 * balances) and dates outside `keys` are skipped.
 */
export function cashFlowByPeriod(
  transactions: readonly Transaction[],
  keys: readonly string[],
  keyOf: (date: string) => string,
  excluded: ReadonlySet<string> = new Set()
): PeriodCashFlow[] {
  const netByPeriod = new Map<string, Map<string, number>>(keys.map((k) => [k, new Map()]));
  for (const t of transactions) {
    const perCategory = netByPeriod.get(keyOf(t.date));
    if (!perCategory || excluded.has(t.id)) continue;
    const category = t.category || UNCATEGORISED;
    perCategory.set(category, (perCategory.get(category) ?? 0) + t.amount);
  }

  return keys.map((key) => {
    const spendingByCategory: Record<string, number> = {};
    const incomeByCategory: Record<string, number> = {};
    let income = 0;
    let spending = 0;
    for (const [category, net] of netByPeriod.get(key)!) {
      const amount = round(Math.abs(net));
      if (amount === 0) continue;
      if (net < 0) {
        spendingByCategory[category] = amount;
        spending += amount;
      } else {
        incomeByCategory[category] = amount;
        income += amount;
      }
    }
    return {
      income: round(income),
      spending: round(spending),
      net: round(income - spending),
      spendingByCategory,
      incomeByCategory,
    };
  });
}

/** `cashFlowByPeriod` with calendar months. */
export function monthlyCashFlow(
  transactions: readonly Transaction[],
  months: MonthKey[],
  excluded: ReadonlySet<string> = new Set()
): MonthCashFlow[] {
  return cashFlowByPeriod(transactions, months, monthOf, excluded).map((flow, i) => ({
    month: months[i]!,
    ...flow,
  }));
}

/** Every category that had spending in any of the months, biggest total first. */
export function spendingCategories(flows: readonly PeriodCashFlow[]): string[] {
  const totals = new Map<string, number>();
  for (const flow of flows)
    for (const [category, amount] of Object.entries(flow.spendingByCategory))
      totals.set(category, (totals.get(category) ?? 0) + amount);
  return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
}

/**
 * The same months with spending limited to `categories` (all when empty), so a chart of a few
 * categories scales to them rather than to total spending. Income is left as it is.
 */
export function onlyCategories<T extends PeriodCashFlow>(
  flows: readonly T[],
  categories: readonly string[]
): T[] {
  if (!categories.length) return [...flows];
  return flows.map((flow) => {
    const spendingByCategory = Object.fromEntries(
      Object.entries(flow.spendingByCategory).filter(([c]) => categories.includes(c))
    );
    const spending = round(Object.values(spendingByCategory).reduce((sum, a) => sum + a, 0));
    return { ...flow, spendingByCategory, spending, net: round(flow.income - spending) };
  });
}

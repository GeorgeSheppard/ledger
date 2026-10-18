import type { Transaction } from '../domain/types';
import { monthOf, type MonthKey } from './months';

/** Label used for transactions with no category. */
export const UNCATEGORISED = 'Uncategorised';

export interface MonthCashFlow {
  month: MonthKey;
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

function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Income and spending per month. Amounts are netted per category first, so a refund reduces that
 * category's spending instead of counting as income. Transactions in `excluded` (transfers,
 * opening balances) are skipped.
 */
export function monthlyCashFlow(
  transactions: readonly Transaction[],
  months: MonthKey[],
  excluded: ReadonlySet<string> = new Set()
): MonthCashFlow[] {
  const netByMonth = new Map<MonthKey, Map<string, number>>(months.map((m) => [m, new Map()]));
  for (const t of transactions) {
    const perCategory = netByMonth.get(monthOf(t.date));
    if (!perCategory || excluded.has(t.id)) continue;
    const category = t.category || UNCATEGORISED;
    perCategory.set(category, (perCategory.get(category) ?? 0) + t.amount);
  }

  return months.map((month) => {
    const spendingByCategory: Record<string, number> = {};
    const incomeByCategory: Record<string, number> = {};
    let income = 0;
    let spending = 0;
    for (const [category, net] of netByMonth.get(month)!) {
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
      month,
      income: round(income),
      spending: round(spending),
      net: round(income - spending),
      spendingByCategory,
      incomeByCategory,
    };
  });
}

/** Every category that had spending in any of the months, biggest total first. */
export function spendingCategories(flows: readonly MonthCashFlow[]): string[] {
  const totals = new Map<string, number>();
  for (const flow of flows)
    for (const [category, amount] of Object.entries(flow.spendingByCategory))
      totals.set(category, (totals.get(category) ?? 0) + amount);
  return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
}

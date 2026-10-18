import type { IsoDate } from '../domain/types';
import { monthlyCashFlow } from '../metrics/cashFlow';
import type { DashboardRange } from '../metrics/dashboard';
import { addMonths, isIsoDate, monthsBetween, monthOf, type MonthKey } from '../metrics/months';
import { dataMonthRange, type AccountLedger } from '../metrics/netWorth';
import { excludedFromCashFlow } from '../metrics/transfers';
import { round, type Paycheck } from './paychecks';

/**
 * Follows the money from pay to spending: income lines → gross pay → deductions and take-home pay →
 * spending categories and savings. The result is plain nodes and links for a Sankey diagram
 * (`../sankey/layout.ts`).
 *
 * Take-home pay is one pool: it is not tied to an account, so it flows to whatever the chosen
 * accounts spent in the months shown, and what is left is "Saved". Spending beyond take-home is
 * shown as "other income" flowing in, so every node's inflow equals its outflow. Transfers between
 * accounts and opening balances are left out, as on the rest of the dashboard.
 */

export type FlowKind =
  'income' | 'gross' | 'deduction' | 'takeHome' | 'category' | 'saved' | 'other';

export interface FlowNode {
  id: string;
  label: string;
  kind: FlowKind;
  /** Left to right: 0 income lines, 1 gross pay, 2 deductions and take-home, 3 spending and savings. */
  column: number;
  /** For `category` nodes, the category name (to pick its colour). */
  category?: string;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number;
}

export interface MoneyFlow {
  nodes: FlowNode[];
  links: FlowLink[];
  /** First and last month covered. */
  from: MonthKey;
  to: MonthKey;
  /** Gross pay, deductions, take-home pay and spending over the whole window. */
  totals: { gross: number; deductions: number; takeHome: number; spending: number };
}

export const OTHER_INCOME_ID = 'other';
export const GROSS_ID = 'gross';
export const TAKE_HOME_ID = 'takeHome';
export const SAVED_ID = 'saved';

/**
 * The months a money-flow chart covers: the last `range` months, ending at the latest month with
 * transactions (or this month when there are none), like the rest of the dashboard.
 */
export function flowWindow(
  ledgers: readonly AccountLedger[],
  paychecks: readonly Paycheck[],
  range: DashboardRange,
  today: IsoDate
): { from: MonthKey; to: MonthKey } {
  const span = dataMonthRange(ledgers);
  const to = span?.last ?? monthOf(today);
  if (range !== 'all') return { from: addMonths(to, 1 - range), to };
  const from =
    [span?.first, ...paychecks.map((p) => monthOf(p.date))]
      .filter((m): m is MonthKey => !!m)
      .sort()[0] ?? to;
  return { from: from < to ? from : to, to };
}

interface Tally {
  label: string;
  value: number;
}

/** Adds to a total keyed by lower-cased name, so "Tax" and "tax" are one line. */
function add(map: Map<string, Tally>, name: string, value: number) {
  const key = name.trim().toLowerCase();
  const found = map.get(key);
  if (found) found.value = round(found.value + value);
  else map.set(key, { label: name.trim(), value: round(value) });
}

function addLink(links: FlowLink[], source: string, target: string, value: number) {
  if (value > 0) links.push({ source, target, value: round(value) });
}

export interface FlowInput {
  paychecks: readonly Paycheck[];
  /** Every account, so transfers can be matched. */
  ledgers: readonly AccountLedger[];
  from: MonthKey;
  to: MonthKey;
  /** Count spending from these accounts only. All when omitted or empty. */
  accountIds?: readonly number[];
  /** Lower-cased names of categories to leave out of the spending side. */
  ignoredCategories?: ReadonlySet<string>;
}

/** Returns null when no paycheck falls in the window. */
export function buildMoneyFlow({
  paychecks,
  ledgers,
  from,
  to,
  accountIds,
  ignoredCategories,
}: FlowInput): MoneyFlow | null {
  if (ledgers.length === 0) return null;
  const chosen = accountIds?.length
    ? ledgers.filter((l) => accountIds.includes(l.account.id))
    : ledgers;

  const incomes = new Map<string, Tally>();
  const deductions = new Map<string, Tally>();
  for (const paycheck of paychecks) {
    const month = monthOf(paycheck.date);
    if (month < from || month > to) continue;
    for (const line of paycheck.income) if (line.amount > 0) add(incomes, line.name, line.amount);
    for (const line of paycheck.deductions)
      if (line.amount > 0) add(deductions, line.name, line.amount);
  }
  if (incomes.size === 0) return null;
  const sumOf = (map: Map<string, Tally>) =>
    round([...map.values()].reduce((total, t) => total + t.value, 0));
  const gross = sumOf(incomes);
  const deducted = sumOf(deductions);
  const takeHome = round(gross - deducted);

  // Spending per category, netted per month like the dashboard.
  const excluded = excludedFromCashFlow(
    ledgers.flatMap((l) => l.transactions.filter((t) => isIsoDate(t.date))),
    ignoredCategories
  );
  const months = monthsBetween(from, to);
  const categoryTotals = new Map<string, number>();
  for (const { transactions } of chosen)
    for (const flow of monthlyCashFlow(transactions, months, excluded))
      for (const [category, amount] of Object.entries(flow.spendingByCategory))
        categoryTotals.set(category, round((categoryTotals.get(category) ?? 0) + amount));
  const spending = round([...categoryTotals.values()].reduce((a, b) => a + b, 0));

  const other = round(Math.max(0, spending - takeHome));
  const saved = round(Math.max(0, takeHome - spending));

  const links: FlowLink[] = [];
  for (const [key] of incomes) addLink(links, `income:${key}`, GROSS_ID, incomes.get(key)!.value);
  for (const [key, d] of deductions) addLink(links, GROSS_ID, `deduction:${key}`, d.value);
  addLink(links, GROSS_ID, TAKE_HOME_ID, takeHome);
  addLink(links, OTHER_INCOME_ID, TAKE_HOME_ID, other);
  for (const [category, amount] of categoryTotals)
    addLink(links, TAKE_HOME_ID, `category:${category}`, amount);
  addLink(links, TAKE_HOME_ID, SAVED_ID, saved);

  const incomeNodes: FlowNode[] = [...incomes]
    .sort((a, b) => b[1].value - a[1].value)
    .map(([key, t]) => ({ id: `income:${key}`, label: t.label, kind: 'income', column: 0 }));
  if (other > 0)
    incomeNodes.push({ id: OTHER_INCOME_ID, label: 'Other income', kind: 'other', column: 0 });
  const deductionNodes: FlowNode[] = [...deductions]
    .sort((a, b) => b[1].value - a[1].value)
    .map(([key, d]) => ({ id: `deduction:${key}`, label: d.label, kind: 'deduction', column: 2 }));
  const categoryNodes: FlowNode[] = [...categoryTotals]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => ({
      id: `category:${category}`,
      label: category,
      kind: 'category',
      column: 3,
      category,
    }));
  if (saved > 0) categoryNodes.push({ id: SAVED_ID, label: 'Saved', kind: 'saved', column: 3 });

  return {
    nodes: [
      ...incomeNodes,
      { id: GROSS_ID, label: 'Gross pay', kind: 'gross', column: 1 },
      ...deductionNodes,
      { id: TAKE_HOME_ID, label: 'Take-home pay', kind: 'takeHome', column: 2 },
      ...categoryNodes,
    ],
    links,
    from,
    to,
    totals: { gross, deductions: deducted, takeHome, spending },
  };
}

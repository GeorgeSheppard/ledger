import type { IsoDate } from '../domain/types';
import { cashFlowByPeriod } from '../metrics/cashFlow';
import { isIsoDate } from '../metrics/months';
import type { AccountLedger } from '../metrics/netWorth';
import { firstDate, type Period } from '../metrics/period';
import { excludedFromCashFlow } from '../metrics/transfers';
import { round, type Paycheck } from './paychecks';

/**
 * Follows the money from pay to spending: income lines → gross pay → deductions and take-home pay →
 * spending categories and savings. The result is plain nodes and links for a Sankey diagram
 * (`../sankey/layout.ts`).
 *
 * Take-home pay is one pool: it is not tied to an account, so it flows to whatever the chosen
 * accounts spent in the period shown, and what is left is "Saved". Spending beyond take-home is
 * shown as "other income" flowing in, so every node's inflow equals its outflow. Transfers between
 * accounts and opening balances are left out, as on the rest of the dashboard.
 */

export type FlowKind =
  | 'income'
  | 'benefit'
  | 'benefitValue'
  | 'gross'
  | 'deduction'
  | 'takeHome'
  | 'category'
  | 'saved'
  | 'other';

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
  /** First and last day covered. */
  from: IsoDate;
  to: IsoDate;
  /**
   * Gross pay, deductions, take-home pay and spending over the whole window, and what take-home
   * pay left unspent (`saved`) or what spending went beyond it (`overspent`); at most one is above 0.
   */
  totals: {
    gross: number;
    deductions: number;
    takeHome: number;
    spending: number;
    saved: number;
    overspent: number;
  };
}

export const OTHER_INCOME_ID = 'other';
export const GROSS_ID = 'gross';
export const BENEFITS_ID = 'benefits';
export const TAKE_HOME_ID = 'takeHome';
export const SAVED_ID = 'saved';

/** From the first transaction or paycheck to today: everything there is to follow. */
export function allTime(
  ledgers: readonly AccountLedger[],
  paychecks: readonly Paycheck[],
  today: IsoDate
): Period {
  const starts = [firstDate(ledgers), ...paychecks.map((p) => p.date)].filter(
    (d): d is IsoDate => !!d
  );
  return { from: starts.sort()[0] ?? today, to: today };
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
  /** First and last day to count, inclusive. */
  from: IsoDate;
  to: IsoDate;
  /** Count spending from these accounts only. All when omitted or empty. */
  accountIds?: readonly number[];
  /** Lower-cased names of categories to leave out of the spending side. */
  ignoredCategories?: ReadonlySet<string>;
  /** Follow take-home pay on into spending and savings. On unless false: false stops at take-home pay. */
  withSpending?: boolean;
}

/** Returns null when no paycheck falls in the window. */
export function buildMoneyFlow({
  paychecks,
  ledgers,
  from,
  to,
  accountIds,
  ignoredCategories,
  withSpending = true,
}: FlowInput): MoneyFlow | null {
  if (withSpending && ledgers.length === 0) return null;
  const chosen = accountIds?.length
    ? ledgers.filter((l) => accountIds.includes(l.account.id))
    : ledgers;

  const incomes = new Map<string, Tally>();
  const benefits = new Map<string, Tally>();
  const deductions = new Map<string, Tally>();
  for (const paycheck of paychecks) {
    if (paycheck.date < from || paycheck.date > to) continue;
    for (const line of paycheck.income) if (line.amount > 0) add(incomes, line.name, line.amount);
    for (const line of paycheck.benefits)
      if (line.amount > 0) add(benefits, line.name, line.amount);
    for (const line of paycheck.deductions)
      if (line.amount > 0) add(deductions, line.name, line.amount);
  }
  if (incomes.size === 0) return null;
  const sumOf = (map: Map<string, Tally>) =>
    round([...map.values()].reduce((total, t) => total + t.value, 0));
  const cash = sumOf(incomes);
  const benefit = sumOf(benefits);
  const gross = round(cash + benefit);
  const deducted = sumOf(deductions);
  const takeHome = round(cash - deducted);

  // Spending per category, netted over the period like the dashboard.
  const excluded = excludedFromCashFlow(
    ledgers.flatMap((l) => l.transactions.filter((t) => isIsoDate(t.date))),
    ignoredCategories
  );
  const categoryTotals = new Map<string, number>();
  for (const { transactions } of withSpending ? chosen : [])
    for (const flow of cashFlowByPeriod(
      transactions,
      ['period'],
      (d) => (d >= from && d <= to ? 'period' : ''),
      excluded
    ))
      for (const [category, amount] of Object.entries(flow.spendingByCategory))
        categoryTotals.set(category, round((categoryTotals.get(category) ?? 0) + amount));
  // Refunds can net a category below zero; it has no ribbon, so it is not spending here either,
  // which keeps the ribbons out of take-home adding up to the spending that Saved is measured from.
  for (const [category, amount] of categoryTotals) if (amount <= 0) categoryTotals.delete(category);
  const spending = round([...categoryTotals.values()].reduce((a, b) => a + b, 0));

  const other = withSpending ? round(Math.max(0, spending - takeHome)) : 0;
  const saved = withSpending ? round(Math.max(0, takeHome - spending)) : 0;

  const links: FlowLink[] = [];
  for (const [key] of incomes) addLink(links, `income:${key}`, GROSS_ID, incomes.get(key)!.value);
  for (const [key, d] of deductions) addLink(links, GROSS_ID, `deduction:${key}`, d.value);
  for (const [key, b] of benefits) addLink(links, `benefit:${key}`, GROSS_ID, b.value);
  addLink(links, GROSS_ID, BENEFITS_ID, benefit);
  addLink(links, GROSS_ID, TAKE_HOME_ID, takeHome);
  addLink(links, OTHER_INCOME_ID, TAKE_HOME_ID, other);
  for (const [category, amount] of categoryTotals)
    addLink(links, TAKE_HOME_ID, `category:${category}`, amount);
  addLink(links, TAKE_HOME_ID, SAVED_ID, saved);

  const incomeNodes: FlowNode[] = [...incomes]
    .sort((a, b) => b[1].value - a[1].value)
    .map(([key, t]) => ({ id: `income:${key}`, label: t.label, kind: 'income', column: 0 }));
  const benefitNodes: FlowNode[] = [...benefits]
    .sort((a, b) => b[1].value - a[1].value)
    .map(([key, t]) => ({ id: `benefit:${key}`, label: t.label, kind: 'benefit', column: 0 }));
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
      ...benefitNodes,
      { id: GROSS_ID, label: 'Gross pay', kind: 'gross', column: 1 },
      ...deductionNodes,
      ...(benefit > 0
        ? [{ id: BENEFITS_ID, label: 'Benefits in kind', kind: 'benefitValue' as const, column: 2 }]
        : []),
      { id: TAKE_HOME_ID, label: 'Take-home pay', kind: 'takeHome', column: 2 },
      ...categoryNodes,
    ],
    links,
    from,
    to,
    totals: { gross, deductions: deducted, takeHome, spending, saved, overspent: other },
  };
}

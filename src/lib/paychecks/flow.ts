import type { IsoDate } from '../domain/types';
import { monthlyCashFlow } from '../metrics/cashFlow';
import type { DashboardRange } from '../metrics/dashboard';
import {
  addMonths,
  isIsoDate,
  monthEnd,
  monthsBetween,
  monthOf,
  type MonthKey,
} from '../metrics/months';
import { dataMonthRange, type AccountLedger } from '../metrics/netWorth';
import { excludedFromCashFlow } from '../metrics/transfers';
import { netPay, paymentDates, round, type Paycheck } from './paychecks';

/**
 * Follows the money from gross pay to where it ends up: paychecks → deductions and take-home pay →
 * accounts → spending categories and savings. The result is plain nodes and links for a Sankey
 * diagram (`../sankey/layout.ts`).
 *
 * Every node's inflow equals its outflow, so the diagram balances: what an account spends beyond
 * the take-home paid into it is shown as "other income" flowing in, and what it does not spend as
 * "saved" flowing out. Transfers between accounts and opening balances are left out, as on the
 * rest of the dashboard.
 */

export type FlowKind =
  'income' | 'deduction' | 'takeHome' | 'account' | 'category' | 'saved' | 'other';

export interface FlowNode {
  id: string;
  label: string;
  kind: FlowKind;
  /** Left to right: 0 income, 1 deductions and take-home, 2 accounts, 3 spending and savings. */
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
  // The latest month with data that is not in the future, like `buildDashboard`.
  const now = monthOf(today);
  const past = ledgers
    .flatMap((l) => l.transactions.map((t) => t.date))
    .filter(isIsoDate)
    .map(monthOf)
    .filter((m) => m <= now);
  const to = past.length ? past.reduce((a, b) => (a > b ? a : b)) : (span?.last ?? now);
  if (range !== 'all') return { from: addMonths(to, 1 - range), to };
  const starts = paychecks
    .map((p) => p.date)
    .filter(isIsoDate)
    .map(monthOf);
  const from = [span?.first, ...starts].filter((m): m is MonthKey => !!m).sort()[0] ?? to;
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

function addLink(links: Map<string, FlowLink>, source: string, target: string, value: number) {
  if (value <= 0) return;
  const key = `${source}\u0000${target}`;
  const found = links.get(key);
  if (found) found.value = round(found.value + value);
  else links.set(key, { source, target, value: round(value) });
}

export interface FlowInput {
  paychecks: readonly Paycheck[];
  /** Every account, so transfers can be matched and unknown destination accounts spotted. */
  ledgers: readonly AccountLedger[];
  from: MonthKey;
  to: MonthKey;
  /** Limit the diagram to these accounts. All when omitted or empty. */
  accountIds?: readonly number[];
}

/** Returns null when no paycheck pays in the window (or none lands in the chosen accounts). */
export function buildMoneyFlow({
  paychecks,
  ledgers,
  from,
  to,
  accountIds,
}: FlowInput): MoneyFlow | null {
  if (ledgers.length === 0) return null;
  const chosen = accountIds?.length
    ? ledgers.filter((l) => accountIds.includes(l.account.id))
    : ledgers;
  const chosenIds = new Set(chosen.map((l) => l.account.id));
  const firstDate: IsoDate = `${from}-01`;
  const lastDate = monthEnd(to);

  const sources = new Map<string, Tally>();
  const deductions = new Map<string, Tally>();
  const intoAccount = new Map<number, number>();
  const sourceToDeduction = new Map<string, FlowLink>();
  const sourceToTakeHome = new Map<string, FlowLink>();

  for (const paycheck of paychecks) {
    const destination = ledgers.find((l) => l.account.id === paycheck.accountId) ?? ledgers[0]!;
    if (!chosenIds.has(destination.account.id)) continue;
    const count = paymentDates(paycheck, firstDate, lastDate).length;
    if (count === 0) continue;
    const sourceKey = `income:${paycheck.name.trim().toLowerCase()}`;
    add(sources, paycheck.name, paycheck.gross * count);
    for (const d of paycheck.deductions) {
      if (d.amount <= 0) continue;
      const key = d.name.trim().toLowerCase();
      add(deductions, d.name, d.amount * count);
      addLink(sourceToDeduction, sourceKey, `deduction:${key}`, d.amount * count);
    }
    const net = round(netPay(paycheck) * count);
    addLink(sourceToTakeHome, sourceKey, TAKE_HOME_ID, net);
    intoAccount.set(
      destination.account.id,
      round((intoAccount.get(destination.account.id) ?? 0) + net)
    );
  }
  if (sources.size === 0) return null;

  // Spending per account and category, netted per month like the dashboard.
  const excluded = excludedFromCashFlow(
    ledgers.flatMap((l) => l.transactions.filter((t) => isIsoDate(t.date)))
  );
  const months = monthsBetween(from, to);
  const spendByAccount = new Map<number, Map<string, number>>();
  const categoryTotals = new Map<string, number>();
  for (const { account, transactions } of chosen) {
    const perCategory = new Map<string, number>();
    for (const flow of monthlyCashFlow(transactions, months, excluded))
      for (const [category, amount] of Object.entries(flow.spendingByCategory)) {
        perCategory.set(category, round((perCategory.get(category) ?? 0) + amount));
        categoryTotals.set(category, round((categoryTotals.get(category) ?? 0) + amount));
      }
    if (perCategory.size) spendByAccount.set(account.id, perCategory);
  }

  const links = new Map<string, FlowLink>();
  const accountNodes: FlowNode[] = [];
  let other = 0;
  let saved = 0;
  let spending = 0;
  for (const { account } of chosen) {
    const inflow = intoAccount.get(account.id) ?? 0;
    const perCategory = spendByAccount.get(account.id);
    const spent = round([...(perCategory?.values() ?? [])].reduce((a, b) => a + b, 0));
    if (inflow === 0 && spent === 0) continue;
    const id = `account:${account.id}`;
    accountNodes.push({ id, label: account.name, kind: 'account', column: 2 });
    addLink(links, TAKE_HOME_ID, id, inflow);
    if (spent > inflow) {
      addLink(links, OTHER_INCOME_ID, id, round(spent - inflow));
      other = round(other + spent - inflow);
    } else {
      addLink(links, id, SAVED_ID, round(inflow - spent));
      saved = round(saved + inflow - spent);
    }
    for (const [category, amount] of perCategory ?? [])
      addLink(links, id, `category:${category}`, amount);
    spending = round(spending + spent);
  }

  const incomeNodes: FlowNode[] = [...sources].map(([key, s]) => ({
    id: `income:${key}`,
    label: s.label,
    kind: 'income',
    column: 0,
  }));
  if (other > 0)
    incomeNodes.push({ id: OTHER_INCOME_ID, label: 'Other income', kind: 'other', column: 0 });
  const deductionNodes: FlowNode[] = [...deductions]
    .sort((a, b) => b[1].value - a[1].value)
    .map(([key, d]) => ({ id: `deduction:${key}`, label: d.label, kind: 'deduction', column: 1 }));
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

  const gross = round([...sources.values()].reduce((sum, s) => sum + s.value, 0));
  const deducted = round([...deductions.values()].reduce((sum, d) => sum + d.value, 0));
  const takeHome = round(gross - deducted);

  const allLinks = [...sourceToDeduction.values(), ...sourceToTakeHome.values(), ...links.values()];
  return {
    nodes: [
      ...incomeNodes,
      ...deductionNodes,
      { id: TAKE_HOME_ID, label: 'Take-home pay', kind: 'takeHome', column: 1 },
      ...accountNodes,
      ...categoryNodes,
    ],
    links: allLinks,
    from,
    to,
    totals: { gross, deductions: deducted, takeHome, spending },
  };
}

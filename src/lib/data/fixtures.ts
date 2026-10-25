import type { Category, TransactionInput } from '../domain/types';
import type { LedgerData } from '../store/ledgerData';

/** Demo data for dev and tests: two accounts with six months of plausible activity. */

export const FIXTURE_CATEGORIES: Category[] = [
  { name: 'Salary', color: '#239382' },
  { name: 'Rent', color: '#fe7ccb' },
  { name: 'Groceries', color: '#dba833' },
  { name: 'Eating out', color: '#7e68e3' },
  { name: 'Transport', color: '#d64b30' },
  { name: 'Bills', color: '#46bdfe' },
  { name: 'Savings', color: '#19d27f', excluded: true },
  { name: 'Interest', color: '#f2b84b', accounts: ['Savings'] },
];

function month(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function currentAccountRows(): TransactionInput[] {
  const rows: TransactionInput[] = [
    { date: '2026-04-01', category: '', amount: 1250, note: 'Opening balance' },
  ];
  for (let m = 0; m < 6; m++) {
    const at = (day: number) => month(2026, 3 + m, day);
    const wobble = (m % 3) * 7.5;
    rows.push(
      { date: at(1), category: 'Rent', amount: -1100, note: 'Monthly rent' },
      { date: at(3), category: 'Groceries', amount: -64.2 - wobble, note: 'Supermarket' },
      { date: at(8), category: 'Transport', amount: -42, note: 'Travel card' },
      { date: at(12), category: 'Eating out', amount: -28.5 - wobble * 2, note: 'Dinner' },
      { date: at(15), category: 'Bills', amount: -96.4, note: 'Energy and broadband' },
      { date: at(18), category: 'Groceries', amount: -71.85 + wobble, note: 'Supermarket' },
      { date: at(25), category: 'Salary', amount: 2850, note: 'Payroll' },
      { date: at(26), category: 'Savings', amount: -500, note: 'Transfer to savings' }
    );
  }
  return rows;
}

function savingsAccountRows(): TransactionInput[] {
  const rows: TransactionInput[] = [
    { date: '2026-04-01', category: '', amount: 8000, note: 'Opening balance' },
  ];
  for (let m = 0; m < 6; m++) {
    rows.push({
      date: month(2026, 3 + m, 26),
      category: 'Savings',
      amount: 500,
      note: 'From current',
    });
  }
  return rows;
}

/** Six payslips matching the transactions, paid on the 25th; the last has a bonus, so tax rises with it. */
function fixturePaychecks() {
  return ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((month, i) => {
    const bonus = i === 5;
    return {
      id: `p${i + 1}`,
      date: `${month}-25`,
      income: [
        { id: 'l1', name: 'Salary', amount: 2600 },
        { id: 'l2', name: 'Allowance', amount: 150 },
        ...(bonus ? [{ id: 'l3', name: 'Bonus', amount: 400 }] : []),
      ],
      benefits: [{ id: 'l1', name: 'Health insurance', amount: 80 }],
      deductions: [
        { id: 'l1', name: 'Income tax', amount: bonus ? 520 : 390 },
        { id: 'l2', name: 'National insurance', amount: bonus ? 190 : 150 },
        { id: 'l3', name: 'Pension', amount: 110 },
        { id: 'l4', name: 'Student loan', amount: bonus ? 70 : 40 },
      ],
    };
  });
}

export function fixtureData(): LedgerData {
  return {
    accounts: [
      { id: 1, name: 'Current account' },
      { id: 2, name: 'Savings' },
    ],
    rows: { 1: currentAccountRows(), 2: savingsAccountRows() },
    categories: FIXTURE_CATEGORIES,
    paychecks: { version: 3, paychecks: fixturePaychecks() },
  };
}

import type { Category, TransactionInput } from '../../../lib/domain/types';
import type { LedgerData } from '../../../lib/store/ledgerData';

/**
 * The example ledger's contents: a year of made-up activity across three accounts. Amounts vary
 * from a seeded generator, so the data looks real but is the same every time it is opened.
 */

const MONTHS = 12;

export const EXAMPLE_CATEGORIES: Category[] = [
  { name: 'Salary', color: '#239382' },
  { name: 'Freelance', color: '#4fb286' },
  { name: 'Interest', color: '#f2b84b', accounts: ['Savings'] },
  { name: 'Refunds', color: '#8fd3c7' },
  { name: 'Rent', color: '#fe7ccb' },
  { name: 'Bills', color: '#46bdfe' },
  { name: 'Phone and internet', color: '#5b8def' },
  { name: 'Groceries', color: '#dba833' },
  { name: 'Eating out', color: '#7e68e3' },
  { name: 'Coffee', color: '#a0724a' },
  { name: 'Transport', color: '#d64b30' },
  { name: 'Fuel', color: '#b8442c' },
  { name: 'Health', color: '#e0607e' },
  { name: 'Fitness', color: '#6cc24a' },
  { name: 'Shopping', color: '#c26be0' },
  { name: 'Clothes', color: '#e58fd0' },
  { name: 'Home', color: '#8a8f98' },
  { name: 'Entertainment', color: '#f08a24' },
  { name: 'Subscriptions', color: '#3d6ee0' },
  { name: 'Travel', color: '#18a0b8' },
  { name: 'Gifts', color: '#d9a0e8' },
  { name: 'Charity', color: '#9ac24a' },
  { name: 'Savings', color: '#19d27f', excluded: true },
  { name: 'Card payment', color: '#9aa3ad', excluded: true },
];

/** Small deterministic random numbers (mulberry32), so the example never changes between opens. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const money = (value: number) => Math.round(value * 100) / 100;

interface Spend {
  category: string;
  note: string;
  min: number;
  max: number;
  /** Roughly how many times a month. */
  perMonth: number;
}

const CARD_SPENDING: Spend[] = [
  { category: 'Groceries', note: 'Supermarket', min: 18, max: 95, perMonth: 6 },
  { category: 'Eating out', note: 'Restaurant', min: 14, max: 70, perMonth: 4 },
  { category: 'Coffee', note: 'Coffee shop', min: 3, max: 6, perMonth: 8 },
  { category: 'Transport', note: 'Train and bus', min: 4, max: 38, perMonth: 5 },
  { category: 'Fuel', note: 'Petrol station', min: 35, max: 70, perMonth: 2 },
  { category: 'Shopping', note: 'Online order', min: 12, max: 120, perMonth: 3 },
  { category: 'Clothes', note: 'Clothes shop', min: 20, max: 110, perMonth: 1 },
  { category: 'Home', note: 'Hardware and homeware', min: 8, max: 90, perMonth: 1 },
  { category: 'Entertainment', note: 'Cinema and events', min: 9, max: 60, perMonth: 2 },
  { category: 'Health', note: 'Pharmacy', min: 5, max: 40, perMonth: 1 },
];

const CARD_FIXED = [
  { day: 4, category: 'Subscriptions', note: 'Streaming', amount: 10.99 },
  { day: 9, category: 'Subscriptions', note: 'Music', amount: 11.99 },
  { day: 14, category: 'Fitness', note: 'Gym membership', amount: 34 },
];

/** Date `day` of the month `monthsAgo` months before this one, clamped to the month's length. */
function dateIn(monthsAgo: number, day: number, now: Date): string {
  const first = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1);
  const length = new Date(
    Date.UTC(new Date(first).getUTCFullYear(), new Date(first).getUTCMonth() + 1, 0)
  ).getUTCDate();
  return new Date(first + (Math.min(day, length) - 1) * 86_400_000).toISOString().slice(0, 10);
}

function byDate(rows: TransactionInput[]): TransactionInput[] {
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function exampleData(now = new Date()): LedgerData {
  const rand = random(2026);
  const between = (min: number, max: number) => money(min + rand() * (max - min));
  const ago = (index: number) => MONTHS - index; // month 0 is the oldest
  const at = (index: number, day: number) => dateIn(ago(index), day, now);

  const current: TransactionInput[] = [
    { date: at(0, 1), category: '', amount: 2400, note: 'Opening balance' },
  ];
  const card: TransactionInput[] = [];
  const savings: TransactionInput[] = [
    { date: at(0, 1), category: '', amount: 9000, note: 'Opening balance' },
  ];
  const paychecks = [];

  for (let m = 0; m < MONTHS; m++) {
    const december = new Date(at(m, 1)).getUTCMonth() === 11;
    const bonus = december ? 600 : 0;
    const gross = 2600 + (m >= 6 ? 150 : 0) + bonus;
    const takeHome = money(gross - 390 - 150 - 110 - 40 - (bonus ? 150 : 0));

    paychecks.push({
      id: `p${m + 1}`,
      date: at(m, 25),
      income: [
        { id: 'l1', name: 'Salary', amount: 2600 + (m >= 6 ? 150 : 0) },
        ...(bonus ? [{ id: 'l2', name: 'Bonus', amount: bonus }] : []),
      ],
      deductions: [
        { id: 'l1', name: 'Income tax', amount: 390 + (bonus ? 110 : 0) },
        { id: 'l2', name: 'National insurance', amount: 150 + (bonus ? 40 : 0) },
        { id: 'l3', name: 'Pension', amount: 110 },
        { id: 'l4', name: 'Student loan', amount: 40 },
      ],
    });

    current.push(
      { date: at(m, 25), category: 'Salary', amount: takeHome, note: 'Payroll' },
      { date: at(m, 1), category: 'Rent', amount: -1100, note: 'Monthly rent' },
      { date: at(m, 5), category: 'Bills', amount: -between(82, 118), note: 'Energy' },
      { date: at(m, 5), category: 'Bills', amount: -34, note: 'Council tax' },
      { date: at(m, 12), category: 'Phone and internet', amount: -46.5, note: 'Broadband' },
      { date: at(m, 12), category: 'Phone and internet', amount: -18, note: 'Mobile' },
      { date: at(m, 26), category: 'Savings', amount: -400, note: 'Transfer to savings' },
      {
        date: at(m, 27),
        category: 'Card payment',
        amount: 0, // filled in once the month's card spending is known
        note: 'Credit card payment',
      }
    );
    if (m % 3 === 1)
      current.push({
        date: at(m, 18),
        category: 'Freelance',
        amount: between(250, 700),
        note: 'Invoice paid',
      });
    if (m % 4 === 2)
      current.push({ date: at(m, 20), category: 'Charity', amount: -25, note: 'Donation' });
    if (december)
      current.push({
        date: at(m, 15),
        category: 'Gifts',
        amount: -between(120, 220),
        note: 'Presents',
      });
    if (m === 5 || m === 11)
      current.push({
        date: at(m, 16),
        category: 'Travel',
        amount: -between(280, 640),
        note: m === 5 ? 'Summer holiday' : 'Flights',
      });
    if (m % 5 === 4)
      current.push({
        date: at(m, 22),
        category: 'Refunds',
        amount: between(15, 60),
        note: 'Refund',
      });

    for (const fixed of CARD_FIXED)
      card.push({
        date: at(m, fixed.day),
        category: fixed.category,
        amount: -fixed.amount,
        note: fixed.note,
      });
    for (const spend of CARD_SPENDING) {
      const times = Math.max(0, Math.round(spend.perMonth + (rand() - 0.5) * 2));
      for (let i = 0; i < times; i++)
        card.push({
          date: at(m, 1 + Math.floor(rand() * 28)),
          category: spend.category,
          amount: -between(spend.min, spend.max),
          note: spend.note,
        });
    }
    const spent = card
      .filter((row) => row.date.startsWith(at(m, 1).slice(0, 7)) && row.amount < 0)
      .reduce((sum, row) => sum - row.amount, 0);
    const payment = money(spent);
    current.find((row) => row.date === at(m, 27) && row.category === 'Card payment')!.amount =
      -payment;
    card.push({
      date: at(m, 27),
      category: 'Card payment',
      amount: payment,
      note: 'Payment received',
    });

    savings.push({ date: at(m, 26), category: 'Savings', amount: 400, note: 'From current' });
    savings.push({
      date: at(m, 28),
      category: 'Interest',
      amount: between(14, 22),
      note: 'Interest',
    });
  }

  return {
    accounts: [
      { id: 1, name: 'Current account' },
      { id: 2, name: 'Credit card' },
      { id: 3, name: 'Savings' },
    ],
    rows: { 1: byDate(current), 2: byDate(card), 3: byDate(savings) },
    categories: EXAMPLE_CATEGORIES,
    paychecks: { version: 3, paychecks },
  };
}

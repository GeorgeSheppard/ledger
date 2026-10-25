import { parseCsv } from '../../../lib/csv/parse';
import {
  netPay,
  newId,
  round,
  type PayLine,
  type Paycheck,
  type PaycheckList,
} from '../../../lib/paychecks/paychecks';
import { detectDateFormat, parseAmount, parseDate, type DateFormat } from '../shared/values';
import type { ImportInput, PaycheckImporter, PaycheckImport } from '../types';

/**
 * George's old paycheck sheet, one row per payslip:
 * Date, Tax Code, Tax Year, Total Income, Pension (Salary Sacrifice), Pension (Employer),
 * Taxable Benefits, Income Tax, NI, Student Loan, Donations, Take Home.
 *
 * - Total Income is the cash income line ("Salary").
 * - Taxable Benefits is a benefit in kind.
 * - Income Tax, NI, Student Loan, Donations and the salary-sacrifice pension are deductions.
 * - Pension (Employer) is paid by the employer and never part of the payslip's take-home sum, so it
 *   is left out; counting it as a benefit in kind would inflate gross pay.
 * - Tax Code and Tax Year are not kept: the paychecks table has no column for them.
 * - Take Home is only used as a check. If the salary-sacrifice pension does not reconcile with it
 *   as a deduction but does without, it was already taken off Total Income and is left out.
 */

const COLUMNS = [
  'date',
  'taxCode',
  'taxYear',
  'income',
  'pensionSacrifice',
  'pensionEmployer',
  'benefits',
  'incomeTax',
  'ni',
  'studentLoan',
  'donations',
  'takeHome',
] as const;
type Column = (typeof COLUMNS)[number];

/** Header spellings, compared after removing everything but letters and digits. */
const HEADERS: Record<Column, RegExp> = {
  date: /^(date|paydate|paid)$/,
  taxCode: /^taxcode$/,
  taxYear: /^taxyear$/,
  income: /^(totalincome|income|gross|grosspay|salary)$/,
  pensionSacrifice: /^pension(salarysacrifice|sacrifice|ss)$/,
  pensionEmployer: /^pension(employer|er)$/,
  benefits: /^(taxablebenefits|benefits|benefitsinkind|bik)$/,
  incomeTax: /^(incometax|tax|paye)$/,
  ni: /^(ni|nationalinsurance)$/,
  studentLoan: /^studentloan$/,
  donations: /^(donations|donation|charity)$/,
  takeHome: /^(takehome|takehomepay|net|netpay)$/,
};

/** Column positions by name, or the sheet's own order when the first row is not a header. */
function locate(first: string[]): { index: Partial<Record<Column, number>>; header: boolean } {
  const index: Partial<Record<Column, number>> = {};
  first.forEach((cell, i) => {
    const key = cell.toLowerCase().replace(/[^a-z0-9]/g, '');
    const column = COLUMNS.find((c) => index[c] === undefined && HEADERS[c].test(key));
    if (column) index[column] = i;
  });
  if (index.date !== undefined && index.income !== undefined) return { index, header: true };
  return { index: Object.fromEntries(COLUMNS.map((c, i) => [c, i])), header: false };
}

const money = (value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

const SOURCE = 'Imported paychecks';

function line(name: string, amount: number | null, existing: PayLine[]): PayLine[] {
  const value = Math.abs(amount ?? 0);
  return value > 0 ? [{ id: newId(existing, 'l'), name, amount: round(value) }] : [];
}

function parseOldPaychecks({ name, text }: ImportInput): PaycheckImport {
  const grid = parseCsv(text);
  if (grid.length === 0) throw new Error(`${name || SOURCE} is empty.`);
  const { index, header } = locate(grid[0]!);
  const rows = header ? grid.slice(1) : grid;
  const cell = (row: string[], column: Column) => {
    const i = index[column];
    return i === undefined ? '' : (row[i] ?? '');
  };
  const amount = (row: string[], column: Column) => parseAmount(cell(row, column));

  const format: DateFormat = detectDateFormat(rows.map((r) => cell(r, 'date'))) ?? 'dmy';
  const warnings: string[] = [];
  const paychecks: Paycheck[] = [];
  let employerPension = 0;

  rows.forEach((row, n) => {
    const label = `Row ${n + (header ? 2 : 1)}`;
    const date = parseDate(cell(row, 'date'), format);
    if (!date) {
      if (row.some((c) => c.trim() !== '')) warnings.push(`${label} skipped: no readable date.`);
      return;
    }
    const income = amount(row, 'income');
    if (!income || income < 0) {
      warnings.push(`${label} (${date}) skipped: Total Income is missing or not positive.`);
      return;
    }

    const sacrifice = Math.abs(amount(row, 'pensionSacrifice') ?? 0);
    const others = (['incomeTax', 'ni', 'studentLoan', 'donations'] as const).reduce(
      (total, c) => total + Math.abs(amount(row, c) ?? 0),
      0
    );
    const takeHome = amount(row, 'takeHome');
    employerPension += Math.abs(amount(row, 'pensionEmployer') ?? 0);

    let deductSacrifice = true;
    if (takeHome !== null) {
      const matches = (expected: number) => Math.abs(round(expected) - takeHome) < 0.01;
      if (!matches(income - sacrifice - others)) {
        if (sacrifice > 0 && matches(income - others)) {
          deductSacrifice = false;
          warnings.push(
            `${label} (${date}): Take Home only adds up without the salary-sacrifice pension, so it is not listed as a deduction.`
          );
        }
      }
    }

    const deductions: PayLine[] = [];
    const add = (lines: PayLine[]) =>
      lines.forEach((l) => deductions.push({ ...l, id: newId(deductions, 'l') }));
    add(line('Income tax', amount(row, 'incomeTax'), deductions));
    add(line('National Insurance', amount(row, 'ni'), deductions));
    add(line('Student loan', amount(row, 'studentLoan'), deductions));
    if (deductSacrifice) add(line('Pension (salary sacrifice)', sacrifice, deductions));
    add(line('Donations', amount(row, 'donations'), deductions));

    const paycheck: Paycheck = {
      id: newId(paychecks, 'p'),
      date,
      income: line('Salary', income, []),
      benefits: line('Taxable benefits', amount(row, 'benefits'), []),
      deductions,
    };
    if (takeHome !== null && Math.abs(netPay(paycheck) - takeHome) >= 0.01)
      warnings.push(
        `${label} (${date}): worked-out take-home ${money(netPay(paycheck))} does not match the Take Home column ${money(takeHome)}.`
      );
    paychecks.push(paycheck);
  });

  if (paychecks.length === 0)
    throw new Error(
      warnings[0] ?? 'No paychecks could be read. Check the columns are in the old sheet order.'
    );
  if (employerPension > 0)
    warnings.push(
      `Pension (Employer) totalling ${money(round(employerPension))} was left out: it is paid by your employer, not part of take-home pay.`
    );
  return { name: name || SOURCE, paychecks, warnings };
}

/** The old paycheck spreadsheet, pasted from the sheet or exported as CSV. */
export const oldPaychecksImporter: PaycheckImporter = {
  id: 'old-paychecks',
  label: 'Old paycheck sheet',
  accepts: 'text',
  parse: parseOldPaychecks,
};

/**
 * Adds imported paychecks to `list` with fresh ids. A paycheck with the same date, income and
 * take-home as one already there is skipped, so importing the same sheet twice changes nothing.
 */
export function mergeImported(
  list: PaycheckList,
  imported: readonly Paycheck[]
): { list: PaycheckList; added: number; skipped: number } {
  const key = (p: Paycheck) => `${p.date}|${p.income.map((l) => l.amount)}|${netPay(p)}`;
  const seen = new Set(list.paychecks.map(key));
  const paychecks = [...list.paychecks];
  let skipped = 0;
  for (const p of imported) {
    if (seen.has(key(p))) {
      skipped++;
      continue;
    }
    seen.add(key(p));
    paychecks.push({ ...p, id: newId(paychecks, 'p') });
  }
  const added = paychecks.length - list.paychecks.length;
  return {
    list: { paychecks: paychecks.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) },
    added,
    skipped,
  };
}

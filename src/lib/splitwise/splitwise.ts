/**
 * Reading the activity list copied from Splitwise's website. The text has no tabs and no
 * per-line transactions: a month heading, then for each expense a day block, a description, who
 * paid, and two amounts (what was paid, and what the payer lent or what you borrowed):
 *
 *   October 2026View printable summary
 *   Oct
 *   25
 *
 *   Weekend cabin trip
 *   Priya N. paid
 *   £41.20Priya lent you
 *   £41.20
 *
 * A Splitwise account tracks IOUs, i.e. spending that is not in the user's other accounts, so each
 * entry's amount is the change in what is owed, not the user's cost:
 *
 *   - "you paid 68, you lent Priya 23" is +23 (Priya owes you 23).
 *   - "Priya paid 68, Priya lent you 23" is -23 (you owe Priya 23).
 *
 * Refunds need no special case: Splitwise writes them from the payer's point of view, so the same
 * rule gives the right sign. Settle-ups are skipped (their wording is not reliably readable) and
 * reported in the warnings.
 */

export interface SplitwiseExpense {
  /** ISO date. */
  date: string;
  description: string;
  /** What changes in the IOU balance: positive when someone owes the user, negative when the user owes. */
  amount: number;
}

export interface SplitwiseParse {
  expenses: SplitwiseExpense[];
  /** Entries left out, in plain words. */
  warnings: string[];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_FULL = new RegExp(
  '^(january|february|march|april|may|june|july|august|september|october|november|december)\\s+(\\d{4})\\s*(?:view printable summary)?$',
  'i'
);
const MONTH_ABBR = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i;
const PAYER = /^(.+?)\s+paid$/i;
const AMOUNT = '[£$€]\\s?(\\d[\\d,]*(?:\\.\\d{1,2})?)';
/** What was paid, then a label such as "you lent Priya", then the lent/borrowed amount. */
const BODY = new RegExp(`${AMOUNT}\\s*(.*?)\\s*${AMOUNT}`);
/** Settling up is a transfer between people, not spending. */
const SETTLE = /^(?:payment|settle|settled)\b|\bsettle(?:d)? (?:up|all)\b/i;

const toNumber = (s: string | undefined) => Number((s ?? '').replace(/,/g, ''));

function clean(line: string): string {
  return line
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether `text` looks like a Splitwise activity paste. */
export function looksLikeSplitwise(text: string): boolean {
  return /view printable summary/i.test(text) || (/\blent\b/i.test(text) && /\bpaid\n/i.test(text));
}

/** IOU change for one expense, or null when the user took no part or the wording is unknown. */
function owed(payer: string, label: string, other: number): number | null {
  if (/^you$/i.test(payer)) return /\byou lent\b/i.test(label) ? other : null;
  return /\blent you\b|\byou (?:borrowed|owe)\b/i.test(label) ? -other : null;
}

export function parseSplitwise(text: string): SplitwiseParse {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map(clean)
    .filter(Boolean);
  const expenses: SplitwiseExpense[] = [];
  let year: number | null = null;
  let monthHeading: number | null = null;
  let day: { month: number; day: number } | null = null;
  let desc: string[] = [];
  let payer: string | null = null;
  let body: string[] = [];
  let skipped = 0;
  let incomplete = 0;

  const abandon = () => {
    if (desc.length > 0 || payer) incomplete++;
    desc = [];
    payer = null;
    body = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const heading = line.match(MONTH_FULL);
    if (heading) {
      abandon();
      year = Number(heading[2]);
      monthHeading = MONTHS.indexOf(heading[1]!.slice(0, 3).toLowerCase()) + 1;
      day = null;
      continue;
    }
    if (MONTH_ABBR.test(line) && /^\d{1,2}$/.test(lines[i + 1] ?? '')) {
      abandon();
      day = { month: MONTHS.indexOf(line.toLowerCase()) + 1, day: Number(lines[i + 1]) };
      i++;
      continue;
    }
    if (!day || year === null) continue;

    if (payer === null) {
      const p = line.match(PAYER);
      if (p && desc.length > 0) payer = p[1]!;
      else desc.push(line);
      continue;
    }

    body.push(line);
    const m = body.join(' ').match(BODY);
    if (!m) continue;
    const description = desc.join(' ');
    const change = SETTLE.test(description) ? null : owed(payer, m[2] ?? '', toNumber(m[3]));
    // A year heading may be "November 2026" while the day block says "Oct": the day block wins,
    // the heading only supplies the year.
    const y = monthHeading !== null && day.month > monthHeading ? year - 1 : year;
    if (change === null) skipped++;
    else {
      const date = `${y}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
      const amount = Math.round(change * 100) / 100;
      expenses.push({ date, description, amount });
    }
    desc = [];
    payer = null;
    body = [];
  }
  abandon();

  const warnings: string[] = [];
  const entries = (n: number) => `${n} Splitwise ${n === 1 ? 'entry' : 'entries'}`;
  if (skipped > 0) {
    warnings.push(
      `${entries(skipped)} (settle-ups, or ones you were not part of) ${skipped === 1 ? 'was' : 'were'} left out.`
    );
  }
  if (incomplete > 0)
    warnings.push(
      `${entries(incomplete)} could not be read and ${incomplete === 1 ? 'was' : 'were'} left out.`
    );
  return { expenses, warnings };
}

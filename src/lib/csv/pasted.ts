import type { IsoDate } from '../domain/types';
import { guessMapping, toTable, type ColumnMapping, type CsvTable } from './mapping';
import { parseAmount, parseDate } from './values';

/**
 * Turning text pasted from a bank's website or app into a table the import screen already
 * understands. Everything here is deterministic: regexes for dates and money, a few rules for
 * which lines are page furniture, and a running-balance check to tell the amount from the balance.
 *
 * Two shapes of paste are handled:
 * - Tab-separated cells (what copying an HTML table gives): handed to `toTable`/`guessMapping`.
 * - Free text, one transaction per line or spread over several lines under date headings. Each
 *   transaction becomes a row of `Date | Description | Amount` with ISO dates and signed amounts,
 *   so the existing mapping editor, preview and import plan work unchanged.
 */

export interface PastedParse {
  kind: 'table' | 'text';
  table: CsvTable;
  mapping: ColumnMapping;
  /** Things the user should double check, in plain words. */
  warnings: string[];
}

export interface PasteOptions {
  /** Today, for `Today`/`Yesterday` and dates without a year. Defaults to the current date. */
  today?: IsoDate;
  /** Read `03/04/2026` as 3 April. Detected from the text when not given, defaulting to true. */
  dayFirst?: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** Month names and three-letter abbreviations only, so `5 MARKET ST` is not 5 March. */
const MONTH_NAME =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\b';
const WEEKDAY = '(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?,?\\s+)?';
const ORDINAL = '(?:st|nd|rd|th)?';

/** Each date layout, with the groups it captures. Searched in this order for the earliest hit. */
const DATE_PATTERNS: { kind: 'iso' | 'numeric' | 'dayName' | 'nameDay'; pattern: RegExp }[] = [
  { kind: 'iso', pattern: /(?<![\d/.-])(\d{4})-(\d{2})-(\d{2})(?![\d])/g },
  {
    kind: 'numeric',
    pattern: /(?<![\d/.-])(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?![\d/]|[.-]\d)/g,
  },
  {
    kind: 'dayName',
    pattern: new RegExp(
      `(?<![\\w])${WEEKDAY}(\\d{1,2})${ORDINAL}[\\s\\-/.]+(${MONTH_NAME})\\.?(?:[\\s\\-/.,]+(\\d{4}|\\d{2})(?![\\d:]))?`,
      'gi'
    ),
  },
  {
    kind: 'nameDay',
    pattern: new RegExp(
      `(?<![\\w])${WEEKDAY}(${MONTH_NAME})\\.?\\s+(\\d{1,2})${ORDINAL}(?:,?\\s+(\\d{4}))?(?![\\d:])`,
      'gi'
    ),
  },
];

/** A decimal amount (`1,204.10`, `23,45`) or a currency symbol with a whole number (`£5`). */
const MONEY = new RegExp(
  [
    '(?<![\\w.,/])',
    '\\(?[-+]?\\s?',
    '(?:[£$€]\\s?[-+]?\\s?\\d[\\d,]*(?:\\.\\d{1,2})?|(?:\\d{1,3}(?:[,.]\\d{3})+|\\d+)[.,]\\d{2})',
    '(?![\\d])\\)?',
    '(?:\\s?(?:CR|DR)\\b|-(?!\\w))?',
  ].join(''),
  'gi'
);

const CURRENCY_CODE = /\b(?:GBP|EUR|USD|CAD|AUD|CHF|SEK|NOK|DKK)\b/gi;
const TIME = /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]m)?\b/gi;
const BALANCE_LABEL = /\b(?:running\s+|available\s+)?bal(?:ance)?\.?:?\s*$/i;

/** Lines that are page furniture, never part of a transaction. */
const JUNK_LINE = new RegExp(
  [
    '^(?:menu|home|search|filter|filters|help|next|previous|back|close|more|print|log ?out|sign ?out)$',
    '^(?:skip to|download|export|show(?:ing)? |view |load |items per page|cookie|accept |manage cookies)',
    '^page \\d+(?: of \\d+)?$',
    '^\\d+ of \\d+$',
    '^(?:©|copyright|privacy|terms|accessibility|contact us)\\b',
    '^(?:pending|completed|processed|posted)(?: transactions?)?:?$',
  ].join('|'),
  'i'
);

/** Lines that name the columns of a table rather than being a transaction. */
const HEADER_WORD =
  /\b(?:date|description|details|amount|balance|debit|credit|money in|money out|paid in|paid out|payee|reference|type|category|transaction)\b/gi;

/** Whole lines (once the numbers are removed) that report a balance or total, not a transaction. */
const SUMMARY_LINE =
  /^(?:(?:opening|closing|starting|ending|previous|new|available|current|statement)\s+balance|balance(?:\s+(?:brought|carried)\s+forward|\s+b\/f|\s+c\/f)?|b\/f|c\/f|total(?:\s+(?:money|paid|credits?|debits?|in|out|spent|received))*|money\s+(?:in|out)|paid\s+(?:in|out))[\s:]*$/i;

/** Descriptions that mean money arrived when the paste gives no sign. */
const INCOME_WORDS =
  /\b(?:salary|wages?|payroll|refund|dividend|deposit|cashback|reversal|interest paid|payment received|payment thank you|thank you|transfer from|incoming|received from)\b/i;

interface Moneyish {
  /** Signed as written; unsigned amounts are positive. */
  value: number;
  /** The paste said which way the money went (sign, brackets, CR/DR). */
  signed: boolean;
  balance: boolean;
}

interface Draft {
  line: number;
  date: IsoDate;
  note: string;
  amount: Moneyish;
  /** The running balance printed beside the amount, when there was one. */
  balance: number | null;
}

type SignSource = 'explicit' | 'balance' | 'keyword' | 'assumed';

function cleanLine(line: string): string {
  return line
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanNote(text: string): string {
  return text
    .replace(TIME, ' ')
    .replace(CURRENCY_CODE, ' ')
    .replace(/[£$€]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s|·•,;:/>\-*]+|[\s|·•,;:/>\-*]+$/g, '')
    .trim();
}

/** Whether day-first or month-first reading fits the numeric dates in `text`. */
function detectDayFirst(text: string): { dayFirst: boolean; evidence: boolean; any: boolean } {
  let dayFirst = false;
  let monthFirst = false;
  let any = false;
  for (const m of text.matchAll(DATE_PATTERNS[1]!.pattern)) {
    any = true;
    if (Number(m[1]) > 12) dayFirst = true;
    if (Number(m[2]) > 12) monthFirst = true;
  }
  if (dayFirst !== monthFirst) return { dayFirst, evidence: true, any };
  return { dayFirst: true, evidence: false, any };
}

function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The year that puts `month`/`day` on or before `today`, for dates written without a year. */
function inferYear(today: IsoDate, month: number, day: number): number {
  const year = Number(today.slice(0, 4));
  const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return candidate > today ? year - 1 : year;
}

interface FoundDate {
  iso: IsoDate;
  start: number;
  end: number;
}

/** The earliest date written anywhere in `line`, or null. */
function findDate(line: string, dayFirst: boolean, today: IsoDate): FoundDate | null {
  let best: FoundDate | null = null;
  for (const { kind, pattern } of DATE_PATTERNS) {
    for (const m of line.matchAll(pattern)) {
      let iso: IsoDate | null;
      if (kind === 'iso') iso = parseDate(`${m[1]}-${m[2]}-${m[3]}`, 'ymd');
      else if (kind === 'numeric') {
        iso = parseDate(`${m[1]}/${m[2]}/${m[3]}`, dayFirst ? 'dmy' : 'mdy');
      } else {
        const day = kind === 'dayName' ? m[1] : m[2];
        const month = kind === 'dayName' ? m[2] : m[1];
        const monthNumber = MONTHS.indexOf((month ?? '').slice(0, 3).toLowerCase()) + 1;
        const y = m[3] ?? String(inferYear(today, monthNumber, Number(day)));
        iso = parseDate(`${day} ${(month ?? '').slice(0, 3)} ${y}`, 'dmy-name');
      }
      if (iso && (!best || m.index < best.start)) {
        best = { iso, start: m.index, end: m.index + m[0].length };
      }
      if (iso) break;
    }
  }
  return best;
}

/** Replaces every date in `line` with a space; returns the first one found. */
function takeDates(
  line: string,
  dayFirst: boolean,
  today: IsoDate
): { first: IsoDate | null; rest: string } {
  let rest = line;
  let first: IsoDate | null = null;
  for (let guard = 0; guard < 4; guard++) {
    const found = findDate(rest, dayFirst, today);
    if (!found) break;
    first ??= found.iso;
    rest = `${rest.slice(0, found.start)} ${rest.slice(found.end)}`;
  }
  return { first, rest };
}

/** Splits money out of `line`: the tokens, and the line with them (and balance labels) removed. */
function takeMoney(line: string): { tokens: Moneyish[]; rest: string } {
  const tokens: Moneyish[] = [];
  let rest = '';
  let cursor = 0;
  for (const m of line.matchAll(MONEY)) {
    const before = line.slice(cursor, m.index);
    const label = before.match(BALANCE_LABEL);
    const value = parseAmount(m[0].trim());
    if (value === null) continue;
    rest += label ? before.slice(0, before.length - label[0].length) : before;
    rest += ' ';
    cursor = m.index + m[0].length;
    tokens.push({
      value,
      signed: /^\(?\s*[-+]|[-+]$|^\(|\b(?:cr|dr)$/i.test(m[0].trim()) || /[£$€]\s?-/.test(m[0]),
      balance: label !== null,
    });
  }
  rest += line.slice(cursor);
  return { tokens, rest };
}

function isHeaderLine(text: string): boolean {
  return new Set(text.toLowerCase().match(HEADER_WORD)).size >= 2;
}

const cents = (n: number) => Math.round(n * 100);

/**
 * Whether the second number on each line is a running balance, and which way the paste is
 * ordered. Looks at how often neighbouring balances differ by exactly the amount between them.
 */
function chainOrder(drafts: readonly Draft[]): 'oldest-first' | 'newest-first' | null {
  let ascending = 0;
  let descending = 0;
  let pairs = 0;
  for (let i = 1; i < drafts.length; i++) {
    const prev = drafts[i - 1]!;
    const next = drafts[i]!;
    if (prev.balance === null || next.balance === null) continue;
    pairs++;
    const step = Math.abs(cents(next.balance) - cents(prev.balance));
    if (step === Math.abs(cents(next.amount.value))) ascending++;
    if (step === Math.abs(cents(prev.amount.value))) descending++;
  }
  if (pairs === 0) return null;
  if (ascending / pairs >= 0.6 && ascending >= descending) return 'oldest-first';
  if (descending / pairs >= 0.6) return 'newest-first';
  return null;
}

function formatAmount(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

const TEXT_HEADERS = ['Date', 'Description', 'Amount'];

const TEXT_MAPPING: ColumnMapping = {
  date: 0,
  amount: 2,
  debit: null,
  credit: null,
  note: 1,
  category: null,
  dateFormat: 'ymd',
  invertAmounts: false,
};

/** Cells of tab-separated lines, when most of the paste is a copied table. */
function tabbedRows(lines: readonly string[]): string[][] | null {
  const filled = lines.filter((l) => l.trim() !== '');
  const counts = new Map<number, number>();
  for (const l of filled) {
    const tabs = l.split('\t').length - 1;
    if (tabs >= 2) counts.set(tabs, (counts.get(tabs) ?? 0) + 1);
  }
  let width = 0;
  let best = 0;
  for (const [tabs, count] of counts) {
    if (count > best) {
      best = count;
      width = tabs;
    }
  }
  if (best < 2 || best < filled.length / 2) return null;
  return filled
    .map((l) => l.split('\t').map((c) => cleanLine(c)))
    .filter((cells) => cells.length - 1 >= width);
}

/**
 * Parses pasted bank text. `table.rows` is empty when nothing that looks like a transaction was
 * found; `warnings` then says so.
 */
export function parsePastedText(text: string, options: PasteOptions = {}): PastedParse {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const rawLines = text.split(/\r\n|\r|\n/);

  const tabbed = tabbedRows(rawLines);
  if (tabbed) {
    const table = toTable(tabbed);
    return { kind: 'table', table, mapping: guessMapping(table), warnings: [] };
  }

  const detected = detectDayFirst(text);
  const dayFirst = options.dayFirst ?? detected.dayFirst;
  const warnings: string[] = [];
  if (options.dayFirst === undefined && detected.any && !detected.evidence) {
    warnings.push(
      `Dates like 03/04/2026 can be read two ways; they are read as ${dayFirst ? 'day' : 'month'} first.`
    );
  }

  const drafts: Draft[] = [];
  let currentDate: IsoDate | null = null;
  let pending: string[] = [];
  let unused = 0;

  for (const [index, raw] of rawLines.entries()) {
    const line = cleanLine(raw);
    if (line === '' || JUNK_LINE.test(line)) continue;

    const relative = line.match(/^(today|yesterday)$/i);
    if (relative) {
      currentDate = relative[1]!.toLowerCase() === 'today' ? today : addDays(today, -1);
      pending = [];
      continue;
    }

    const { first: ownDate, rest: withoutDates } = takeDates(line, dayFirst, today);
    const { tokens, rest: withoutMoney } = takeMoney(withoutDates);
    const note = cleanNote(withoutMoney);
    if (tokens.length === 0 && (isHeaderLine(note) || SUMMARY_LINE.test(note))) continue;

    if (tokens.length === 0) {
      if (ownDate) {
        currentDate = ownDate;
        pending = note ? [note] : [];
      } else if (note) {
        pending = [...pending, note].slice(-2);
      }
      continue;
    }

    if (SUMMARY_LINE.test(note)) {
      pending = [];
      continue;
    }
    const date: IsoDate | null = ownDate ?? currentDate;
    if (!date) {
      unused++;
      pending = [];
      continue;
    }
    currentDate = date;

    const labelledBalance = tokens.find((t) => t.balance);
    const plain = tokens.filter((t) => !t.balance);
    const amount = plain[0];
    if (!amount) {
      pending = [];
      continue;
    }
    const printedBalance =
      labelledBalance?.value ?? (plain.length >= 2 ? plain[plain.length - 1]!.value : null);
    drafts.push({
      line: index + 1,
      date,
      note: ownDate ? note : [...pending, note].filter(Boolean).join(' '),
      amount,
      balance: printedBalance,
    });
    pending = [];
  }

  const order = chainOrder(drafts);
  const sources: Record<SignSource, number> = { explicit: 0, balance: 0, keyword: 0, assumed: 0 };

  const signed = drafts.map((d, i) => {
    const magnitude = Math.abs(d.amount.value);
    if (d.amount.signed) {
      sources.explicit++;
      return d.amount.value;
    }
    const neighbour = order === 'oldest-first' ? drafts[i - 1] : drafts[i + 1];
    if (order && d.balance !== null && neighbour?.balance != null) {
      sources.balance++;
      return d.balance >= neighbour.balance ? magnitude : -magnitude;
    }
    if (INCOME_WORDS.test(d.note)) {
      sources.keyword++;
      return magnitude;
    }
    sources.assumed++;
    return -magnitude;
  });

  if (drafts.length === 0) {
    warnings.push('No transactions found. Each one needs a date and an amount.');
  } else if (sources.assumed > 0) {
    warnings.push(
      `${sources.assumed} amount${sources.assumed === 1 ? ' has' : 's have'} no sign, so ${
        sources.assumed === 1 ? 'it is' : 'they are'
      } treated as money out. Use the invert option if that is the wrong way round.`
    );
  }
  if (unused > 0) {
    warnings.push(
      `${unused} line${unused === 1 ? '' : 's'} with an amount but no date ${
        unused === 1 ? 'was' : 'were'
      } skipped.`
    );
  }

  const rows = drafts.map((d, i) => [d.date, d.note, formatAmount(signed[i] ?? 0)]);
  return {
    kind: 'text',
    table: {
      headers: TEXT_HEADERS,
      rows,
      lines: drafts.map((d) => d.line),
      hasHeader: true,
    },
    mapping: { ...TEXT_MAPPING },
    warnings,
  };
}

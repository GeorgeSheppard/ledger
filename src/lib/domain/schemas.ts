import { z } from 'zod';
import { isIsoDate } from '../transactions/dates';

/**
 * The shapes of Ledger's core data, as zod schemas. These are the source of truth: the types in
 * `./types.ts` are inferred from them, and anything read from outside the running app (a sheet, a
 * file, IndexedDB, storage) is checked against them.
 */

export const isoDateSchema = z.string().refine(isIsoDate, 'Not a YYYY-MM-DD date');

export const accountSchema = z.object({
  /** The tab's numeric sheet id. Stable across renames and reordering. */
  id: z.number().int(),
  name: z.string(),
});

/** The fields a caller supplies when adding or editing a transaction. */
export const transactionInputSchema = z.object({
  date: isoDateSchema,
  /** Category name, matching a `Category.name`. Empty string when uncategorised. */
  category: z.string(),
  /** Positive for money in, negative for money out. */
  amount: z.number().finite(),
  note: z.string(),
});

/** One row in an account tab: Date, Category, Amount, Note, Total. */
export const transactionSchema = transactionInputSchema.extend({
  /** Unique within the spreadsheet: `${accountId}:${row}`. Changes if rows are inserted above. */
  id: z.string(),
  accountId: z.number().int(),
  /** 1-based spreadsheet row number (row 1 is the header). */
  row: z.number().int().positive(),
  /** Running balance after this transaction. Computed by the sheet; read-only. */
  total: z.number(),
});

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
export const FALLBACK_COLOR = '#8b8d98';

export const categorySchema = z.object({
  name: z.string(),
  /** Hex colour used in charts and chips, e.g. `#4f7cff`. A missing or invalid one is grey. */
  color: z.string().regex(HEX_COLOR).catch(FALLBACK_COLOR),
});

/** The spreadsheet the user has connected. */
export const spreadsheetRefSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
});

/** Parses `value` with `schema`, or throws an `Error` that says what was wrong and where. */
export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  value: unknown,
  what: string
): z.infer<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(`${what}: ${describeIssue(result.error)}`);
}

/** The first problem in a zod error, as `path: message`. */
export function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'invalid data';
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

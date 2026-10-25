import { z } from 'zod';
import { accountSchema, categorySchema, transactionInputSchema } from '../domain/schemas';

/**
 * Schemas for the working copy of a spreadsheet. The store's types are inferred from these, and the
 * browser cache checks what it reads back against them, since IndexedDB outlives app versions.
 */

/** Anything `JSON.stringify` round-trips. Used for the dashboard and paychecks, which own their shape. */
export const jsonSchema = z.json();

export const ledgerDataSchema = z.object({
  /** Account tabs in tab order. */
  accounts: z.array(accountSchema),
  /** Rows per account id, oldest first. */
  rows: z.record(z.coerce.number().int(), z.array(transactionInputSchema)),
  categories: z.array(categorySchema),
  /** Contents of the `Ledger_Dashboard` tab, or `null` when there is none yet. */
  dashboard: jsonSchema.nullable(),
  /** Contents of the `Paychecks` tab in the app's JSON shape, or `null` when there is none yet. */
  paychecks: jsonSchema.nullable(),
});

/** A tab that is not an account because it does not match the sheet format. */
export const skippedTabSchema = z.object({ title: z.string(), reason: z.string() });

export const sheetLayoutSchema = z.object({
  /** Row count of every tab's grid, by sheet id. Writing past it needs the grid to grow first. */
  rowCounts: z.record(z.coerce.number().int(), z.number()),
  /** Every sheet id in use, including skipped and reserved tabs, so new tabs get a fresh one. */
  sheetIds: z.array(z.number().int()),
  /** The legacy `_Categories` tab, deleted when `Ledger_Metadata` takes over on the next save. */
  categoriesSheetId: z.number().int().optional(),
  metadataSheetId: z.number().int().optional(),
  dashboardSheetId: z.number().int().optional(),
  paychecksSheetId: z.number().int().optional(),
  /** The `Paychecks` tab still has the old one-cell JSON layout; the next write replaces it with the table. */
  paychecksLegacy: z.boolean().optional(),
  /** Tabs still under an old name (`Ledger_Metadata`…), by sheet id → the name they get on the next save. */
  renames: z.record(z.coerce.number().int(), z.string()).optional(),
});

export const remoteStateSchema = z.object({
  /** The data as it is in the sheet. */
  data: ledgerDataSchema,
  skippedTabs: z.array(skippedTabSchema),
  /** Remote bookkeeping (grid sizes, tab ids). Plain JSON so it can be cached; only the remote reads it. */
  layout: sheetLayoutSchema,
});

/** The browser's copy of one spreadsheet: the last saved state plus the working copy. */
export const cachedLedgerSchema = z.object({
  saved: remoteStateSchema,
  current: ledgerDataSchema,
});

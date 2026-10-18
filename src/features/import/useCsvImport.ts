import { useCallback, useMemo, useState } from 'react';
import type { Category, Transaction } from '../../lib/domain/types';
import { buildImportPlan, withNewCategories, type ImportPlan } from '../../lib/csv/importPlan';
import { guessMapping, toTable, type ColumnMapping, type CsvTable } from '../../lib/csv/mapping';
import { parseCsv } from '../../lib/csv/parse';
import { useLedgerMutation } from '../../state/ledgerData';

/**
 * State for importing a file into one account: the loaded file, its column mapping, and the plan
 * derived from them. All parsing and matching happens in `lib/csv`; this hook only wires it up.
 */

export interface LoadedFile {
  name: string;
  parsed: string[][];
  table: CsvTable;
}

export interface ImportResult {
  added: number;
  skipped: number;
  categoriesAdded: number;
}

/** `existing` and `categories` are what the account page already shows, so nothing is re-read. */
export function useCsvImport(accountId: number, existing: Transaction[], categories: Category[]) {
  const mutate = useLedgerMutation();

  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const plan: ImportPlan | null = useMemo(() => {
    if (!file || !mapping) return null;
    return buildImportPlan(file.table, mapping, existing, categories);
  }, [file, mapping, existing, categories]);

  const loadFile = useCallback(async (blob: File) => {
    setError(null);
    setResult(null);
    try {
      const parsed = parseCsv(await blob.text());
      const table = toTable(parsed);
      if (table.rows.length === 0) throw new Error(`${blob.name} has no rows to import.`);
      setFile({ name: blob.name, parsed, table });
      setMapping(guessMapping(table));
    } catch (e) {
      setFile(null);
      setMapping(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  /** Re-reads the file with or without a header row and re-guesses the mapping. */
  const setHasHeader = useCallback(
    (hasHeader: boolean) => {
      if (!file) return;
      const table = toTable(file.parsed, hasHeader);
      setFile({ ...file, table });
      setMapping(guessMapping(table));
    },
    [file]
  );

  const reset = useCallback(() => {
    setFile(null);
    setMapping(null);
    setResult(null);
    setError(null);
  }, []);

  const confirm = useCallback(async () => {
    if (!plan || plan.toAdd.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      await mutate(async (repository) => {
        if (plan.newCategories.length) {
          await repository.saveCategories(withNewCategories(categories, plan.newCategories));
        }
        await repository.addTransactions(accountId, plan.toAdd);
      });
      setResult({
        added: plan.toAdd.length,
        skipped: plan.counts.existing,
        categoriesAdded: plan.newCategories.length,
      });
      setFile(null);
      setMapping(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }, [accountId, plan, categories, mutate]);

  return {
    file,
    mapping,
    setMapping,
    setHasHeader,
    plan,
    error,
    importing,
    result,
    loadFile,
    reset,
    confirm,
  };
}

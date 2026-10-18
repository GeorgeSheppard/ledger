import { useCallback, useMemo, useState } from 'react';
import type { Account } from '../../lib/domain/types';
import { guessAccount } from '../../lib/csv/account';
import { buildImportPlan, withNewCategories, type ImportPlan } from '../../lib/csv/importPlan';
import { guessMapping, toTable, type ColumnMapping, type CsvTable } from '../../lib/csv/mapping';
import { parseCsv } from '../../lib/csv/parse';
import { useLedger, useLedgerMutation } from '../../state/ledgerData';

/**
 * State for the import screen: the loaded file, the chosen account and mapping, and the plan
 * derived from them. All parsing and matching happens in `lib/csv`; this hook only wires it up.
 */

export interface LoadedFile {
  name: string;
  parsed: string[][];
  table: CsvTable;
}

export interface ImportResult {
  account: Account;
  added: number;
  skipped: number;
  categoriesAdded: number;
}

export function useCsvImport() {
  const ledger = useLedger();
  const categories = useMemo(
    () => ({ status: 'ready', data: ledger.categories }) as const,
    [ledger.categories]
  );
  const mutate = useLedgerMutation();

  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [chosenAccountId, setAccountId] = useState<number | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const accountList = useMemo(() => ledger.accounts, [ledger.accounts]);
  const accountId =
    chosenAccountId !== null && accountList.some((a) => a.id === chosenAccountId)
      ? chosenAccountId
      : (accountList[0]?.id ?? null);

  const existing = useMemo(
    () =>
      ({
        status: 'ready',
        data: (accountId === null ? undefined : ledger.transactionsByAccount[accountId]) ?? [],
        error: null,
      }) as const,
    [accountId, ledger.transactionsByAccount]
  );

  const plan: ImportPlan | null = useMemo(() => {
    if (!file || !mapping || existing.status !== 'ready' || categories.status !== 'ready') {
      return null;
    }
    return buildImportPlan(file.table, mapping, existing.data, categories.data);
  }, [file, mapping, existing, categories]);

  const loadFile = useCallback(
    async (blob: File) => {
      setError(null);
      setResult(null);
      try {
        const parsed = parseCsv(await blob.text());
        const table = toTable(parsed);
        if (table.rows.length === 0) throw new Error(`${blob.name} has no rows to import.`);
        setFile({ name: blob.name, parsed, table });
        setMapping(guessMapping(table));
        setAccountId(guessAccount(blob.name, accountList)?.id ?? null);
      } catch (e) {
        setFile(null);
        setMapping(null);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [accountList]
  );

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
    const account = accountList.find((a) => a.id === accountId);
    if (!plan || !account || plan.toAdd.length === 0 || categories.status !== 'ready') return;
    setImporting(true);
    setError(null);
    try {
      await mutate(async (repository) => {
        if (plan.newCategories.length) {
          await repository.saveCategories(withNewCategories(categories.data, plan.newCategories));
        }
        await repository.addTransactions(account.id, plan.toAdd);
      });
      setResult({
        account,
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
  }, [accountList, accountId, plan, categories, mutate]);

  return {
    accounts: accountList,
    accountId,
    setAccountId,
    file,
    mapping,
    setMapping,
    setHasHeader,
    plan,
    loading: false,
    loadError: null as Error | null,
    error,
    importing,
    result,
    loadFile,
    reset,
    confirm,
  };
}

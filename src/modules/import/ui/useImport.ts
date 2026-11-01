import { useCallback, useMemo, useState } from 'react';
import type { Category, Transaction } from '../../../lib/domain/types';
import {
  csvImporter,
  pastedTextImporter,
  type ImportInput,
  type ImportOptions,
  type Importer,
  type ParsedImport,
} from '..';
import { buildCategoryIndex } from '../../../lib/categories/suggest';
import {
  buildImportPlan,
  type CategoryOverrides,
  withNewCategories,
  type ImportPlan,
} from '../shared/importPlan';
import { guessMapping, toTable, type ColumnMapping } from '../shared/mapping';
import { useLedger, useLedgerMutation } from '../../../state/ledgerData';

/**
 * State for importing into one account: what an importer read, its column mapping, and the plan
 * derived from them. Parsing is the importers' job and matching is `shared/importPlan`; this hook
 * only wires them up, so it works the same for every importer.
 */

/** What the user pasted, kept so the day/month order can be changed without pasting again. */
export interface PastedSource {
  text: string;
  warnings: string[];
  ambiguousDates: boolean;
  dayFirst: boolean;
}

/** `existing` and `categories` are what the account page already shows, so nothing is re-read. */
export function useImport(accountId: number, existing: Transaction[], categories: Category[]) {
  const mutate = useLedgerMutation();
  const { transactionsByAccount } = useLedger();
  // Past transactions from every account, so a shop seen in one account is known in the others.
  const suggestions = useMemo(
    () => buildCategoryIndex(Object.values(transactionsByAccount).flat()),
    [transactionsByAccount]
  );
  const [overrides, setOverrides] = useState<CategoryOverrides>({});

  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [source, setSource] = useState<{ importer: Importer; input: ImportInput } | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const plan: ImportPlan | null = useMemo(() => {
    if (!parsed || !mapping) return null;
    return buildImportPlan(parsed.table, mapping, existing, categories, suggestions, overrides);
  }, [parsed, mapping, existing, categories, suggestions, overrides]);

  const clear = useCallback(() => {
    setParsed(null);
    setSource(null);
    setMapping(null);
    setOverrides({});
  }, []);

  /** Reads `input` with any importer. Sets `error` and clears the screen when nothing was read. */
  const load = useCallback(
    (importer: Importer, input: ImportInput, options?: ImportOptions) => {
      setError(null);
      try {
        const next = importer.parse(input, options);
        setParsed(next);
        setSource({ importer, input });
        setMapping(next.mapping);
        setOverrides({});
      } catch (e) {
        clear();
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [clear]
  );

  const loadFile = useCallback(
    async (blob: File) => {
      let text: string;
      try {
        text = await blob.text();
      } catch (e) {
        clear();
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
      load(csvImporter, { name: blob.name, text });
    },
    [load, clear]
  );

  /** Reads text pasted from a bank's website. `dayFirst` overrides the detected date order. */
  const loadText = useCallback(
    (text: string, dayFirst?: boolean) =>
      load(pastedTextImporter, { name: 'Pasted text', text }, { dayFirst }),
    [load]
  );

  /** Re-reads the rows with or without a header row and re-guesses the mapping. */
  const setHasHeader = useCallback(
    (hasHeader: boolean) => {
      if (!parsed) return;
      const table = toTable(parsed.grid, hasHeader);
      setParsed({ ...parsed, table });
      setMapping(guessMapping(table));
      setOverrides({});
    },
    [parsed]
  );

  const file = parsed && { name: parsed.name, table: parsed.table };
  const pasted: PastedSource | null =
    parsed?.dates && source
      ? {
          text: source.input.text,
          warnings: parsed.warnings,
          ambiguousDates: parsed.dates.ambiguous,
          dayFirst: parsed.dates.dayFirst,
        }
      : null;

  const reset = useCallback(() => {
    clear();
    setError(null);
  }, [clear]);

  /** Adds the planned rows. Resolves true once saved, false if nothing was added. */
  const confirm = useCallback(async (): Promise<boolean> => {
    if (!plan || plan.toAdd.length === 0) return false;
    setImporting(true);
    setError(null);
    try {
      await mutate(async (repository) => {
        if (plan.newCategories.length) {
          await repository.saveCategories(withNewCategories(categories, plan.newCategories));
        }
        await repository.addTransactions(accountId, plan.toAdd);
      });
      clear();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setImporting(false);
    }
  }, [accountId, plan, categories, mutate, clear]);

  return {
    file,
    mapping,
    setMapping,
    /** Sets the category of the preview row on `line`, replacing the guess. */
    setCategory: (line: number, category: string) =>
      setOverrides((o) => ({ ...o, [line]: category })),
    setHasHeader,
    plan,
    error,
    importing,
    pasted,
    loadFile,
    loadText,
    reset,
    confirm,
  };
}

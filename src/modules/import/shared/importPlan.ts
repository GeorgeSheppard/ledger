import type { Category, Transaction, TransactionInput } from '../../../lib/domain/types';
import { applyMapping, mappingProblems, type ColumnMapping, type CsvTable } from './mapping';
import { reconcile } from './reconcile';

/**
 * Everything the import screen shows and does, computed in one pass: each row's status, the
 * transactions to add (oldest first, as the sheet is), and any categories that need creating.
 */

export type PlanRowStatus = 'new' | 'existing' | 'invalid';

export interface PlanRow {
  line: number;
  cells: string[];
  status: PlanRowStatus;
  input?: TransactionInput;
  error?: string;
}

export interface ImportPlan {
  rows: PlanRow[];
  /** Problems with the mapping itself. When non-empty, `rows` is empty. */
  problems: string[];
  toAdd: TransactionInput[];
  /** Category names used by new rows that are not in the category list yet. */
  newCategories: string[];
  counts: Record<PlanRowStatus, number>;
}

const CATEGORY_COLORS = ['#4f7cff', '#2f9e6b', '#e8913a', '#8e6bd6', '#c2577f', '#3aa6b9'];

/** Matches category names case-insensitively to the existing list so `groceries` → `Groceries`. */
function canonicalCategory(name: string, categories: readonly Category[]): string {
  const trimmed = name.trim();
  return categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())?.name ?? trimmed;
}

export function buildImportPlan(
  table: CsvTable,
  mapping: ColumnMapping,
  existing: readonly Transaction[],
  categories: readonly Category[]
): ImportPlan {
  const problems = mappingProblems(mapping);
  const counts: Record<PlanRowStatus, number> = { new: 0, existing: 0, invalid: 0 };
  if (problems.length) return { rows: [], problems, toAdd: [], newCategories: [], counts };

  const mapped = applyMapping(table, mapping).map((row) =>
    row.input
      ? {
          ...row,
          input: { ...row.input, category: canonicalCategory(row.input.category, categories) },
        }
      : row
  );
  const valid = mapped.filter((r) => r.input);
  const statuses = reconcile(
    valid.map((r) => r.input!),
    existing
  );
  let next = 0;
  const rows: PlanRow[] = mapped.map((r) =>
    r.input
      ? { line: r.line, cells: r.cells, input: r.input, status: statuses[next++] ?? 'new' }
      : { line: r.line, cells: r.cells, error: r.error, status: 'invalid' }
  );
  for (const r of rows) counts[r.status]++;

  const toAdd = rows
    .filter((r) => r.status === 'new')
    .map((r) => r.input!)
    .sort((a, b) => a.date.localeCompare(b.date));

  const known = new Set(categories.map((c) => c.name));
  const newCategories = [...new Set(toAdd.map((t) => t.category))].filter(
    (name) => name !== '' && !known.has(name)
  );

  return { rows, problems, toAdd, newCategories, counts };
}

/** The category list with `names` appended, each given a colour from a fixed palette. */
export function withNewCategories(
  categories: readonly Category[],
  names: readonly string[]
): Category[] {
  return [
    ...categories,
    ...names.map((name, i) => ({
      name,
      color: CATEGORY_COLORS[(categories.length + i) % CATEGORY_COLORS.length] ?? '#4f7cff',
    })),
  ];
}

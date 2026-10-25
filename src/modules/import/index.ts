import { csvImporter } from './csv';
import { oldPaychecksImporter, mergeImported } from './old-paychecks';
import { pastedTextImporter } from './pasted-text';
import type { Importer, PaycheckImporter } from './types';

export type {
  ImportInput,
  ImportOptions,
  Importer,
  ParsedImport,
  PaycheckImport,
  PaycheckImporter,
} from './types';
export { buildImportPlan, withNewCategories, type ImportPlan } from './shared/importPlan';
export { csvImporter, pastedTextImporter, oldPaychecksImporter, mergeImported };

/** Every importer the Paychecks page offers. */
export const PAYCHECK_IMPORTERS: readonly PaycheckImporter[] = [oldPaychecksImporter];

/** Every importer the import screen offers. Add a new one here and nowhere else. */
export const IMPORTERS: readonly Importer[] = [csvImporter, pastedTextImporter];

export function importerById(id: string): Importer {
  const found = IMPORTERS.find((i) => i.id === id);
  if (!found) throw new Error(`Unknown importer: ${id}`);
  return found;
}

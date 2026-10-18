import { csvImporter } from './csv';
import { pastedTextImporter } from './pasted-text';
import type { Importer } from './types';

export type { ImportInput, ImportOptions, Importer, ParsedImport } from './types';
export { buildImportPlan, withNewCategories, type ImportPlan } from './shared/importPlan';
export { csvImporter, pastedTextImporter };

/** Every importer the import screen offers. Add a new one here and nowhere else. */
export const IMPORTERS: readonly Importer[] = [csvImporter, pastedTextImporter];

export function importerById(id: string): Importer {
  const found = IMPORTERS.find((i) => i.id === id);
  if (!found) throw new Error(`Unknown importer: ${id}`);
  return found;
}

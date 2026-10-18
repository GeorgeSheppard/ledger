import { guessMapping, toTable } from '../shared/mapping';
import { parseCsv } from '../../../lib/csv/parse';
import type { Importer } from '../types';

/** A CSV file from a bank or another app. The delimiter and header row are detected. */
export const csvImporter: Importer = {
  id: 'csv',
  label: 'CSV file',
  accepts: 'file',
  parse({ name, text }) {
    const grid = parseCsv(text);
    const table = toTable(grid);
    if (table.rows.length === 0) throw new Error(`${name} has no rows to import.`);
    return { name, grid, table, mapping: guessMapping(table), warnings: [] };
  },
};

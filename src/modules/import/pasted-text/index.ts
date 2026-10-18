import type { Importer } from '../types';
import { parsePastedText } from './pasted';

/** Text copied from a bank's website or app. The structure is worked out with heuristics. */
export const pastedTextImporter: Importer = {
  id: 'pasted-text',
  label: 'Pasted text',
  accepts: 'text',
  parse({ name, text }, options = {}) {
    const parsed = parsePastedText(text, { dayFirst: options.dayFirst });
    if (parsed.table.rows.length === 0)
      throw new Error(parsed.warnings.join(' ') || 'Nothing in the pasted text could be read.');
    const { headers, rows } = parsed.table;
    return {
      name,
      grid: [headers, ...rows],
      table: parsed.table,
      mapping: parsed.mapping,
      warnings: parsed.warnings,
      dates: { ambiguous: parsed.ambiguousDates, dayFirst: parsed.dayFirst },
    };
  },
};

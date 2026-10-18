import type { ColumnMapping, CsvTable } from './shared/mapping';

/** Text to import and what to call it (a file name, or "Pasted text"). */
export interface ImportInput {
  name: string;
  text: string;
}

export interface ImportOptions {
  /** Read numeric dates such as 03/04/2026 day first. Importers that can detect it do so when unset. */
  dayFirst?: boolean;
}

/**
 * What every importer produces, whatever it parsed: a table, the guessed mapping of its columns to
 * transaction fields, and anything the user should double check. The import screen, preview and
 * plan work from this shape only.
 */
export interface ParsedImport {
  name: string;
  /** Every row as read, header row included, so the header row can be switched on or off later. */
  grid: string[][];
  table: CsvTable;
  mapping: ColumnMapping;
  /** Things the user should double check, in plain words. */
  warnings: string[];
  /** Set by importers that read free-form dates, so the screen can offer day/month order. */
  dates?: { ambiguous: boolean; dayFirst: boolean };
}

/**
 * One way of turning text into transactions to import. Throws an `Error` with a readable message
 * when nothing could be read.
 */
export interface Importer {
  readonly id: string;
  readonly label: string;
  /** What the user hands over: a chosen file, or text pasted from a website. */
  readonly accepts: 'file' | 'text';
  parse(input: ImportInput, options?: ImportOptions): ParsedImport;
}

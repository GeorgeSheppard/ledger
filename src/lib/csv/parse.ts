import Papa from 'papaparse';

/**
 * CSV text → rows of cells, via Papa Parse. The delimiter (comma, semicolon or tab) is detected
 * from the text, because European bank exports often use semicolons.
 */

/** Parses CSV text into rows. Cells are trimmed; rows that are entirely empty are dropped. */
export function parseCsv(text: string): string[][] {
  const { data } = Papa.parse<string[]>(text, {
    delimitersToGuess: [',', ';', '\t'],
    skipEmptyLines: 'greedy',
    transform: (cell) => cell.trim(),
  });
  return data;
}

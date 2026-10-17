/**
 * CSV text → rows of cells. Small RFC 4180 parser: quoted fields, doubled quotes, embedded
 * newlines, CRLF or LF, a leading BOM. The delimiter (comma, semicolon or tab) is detected from the
 * first line, because European bank exports often use semicolons.
 */

export type Delimiter = ',' | ';' | '\t';

const DELIMITERS: Delimiter[] = [',', ';', '\t'];

/** The delimiter that appears most often outside quotes on the first line. Defaults to comma. */
export function detectDelimiter(text: string): Delimiter {
  const counts = new Map<Delimiter, number>(DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;
  for (const char of text) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (char === '\n' || char === '\r')) break;
    else if (!inQuotes && counts.has(char as Delimiter)) {
      counts.set(char as Delimiter, (counts.get(char as Delimiter) ?? 0) + 1);
    }
  }
  let best: Delimiter = ',';
  for (const d of DELIMITERS) if ((counts.get(d) ?? 0) > (counts.get(best) ?? 0)) best = d;
  return best;
}

/** Parses CSV text into rows. Cells are trimmed; rows that are entirely empty are dropped. */
export function parseCsv(text: string, delimiter: Delimiter = detectDelimiter(text)): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const endCell = () => {
    row.push(cell.trim());
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

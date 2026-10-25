import type { SpreadsheetRef } from '../../../lib/domain/types';
import { parseSpreadsheet, readRange } from '../../../lib/google/parseSpreadsheet';
import type { SheetsClient } from '../../../lib/google/sheetsClient';
import { cloudSaver } from '../../save';
import type { Connection, Ingest } from '../types';

/**
 * Reads a Google Sheet. Loading costs two read requests whatever the number of tabs: the tab list,
 * then every tab's values in one batch.
 */
export function googleConnection(client: SheetsClient, spreadsheet: SpreadsheetRef): Connection {
  return {
    title: spreadsheet.title,
    saver: cloudSaver(client, spreadsheet.id),
    async load(onProgress) {
      onProgress?.({ step: 'tabs' });
      const metadata = await client.getMetadata(spreadsheet.id);
      const tabs = metadata.sheets.map((s) => s.properties).sort((a, b) => a.index - b.index);
      const reads = tabs.flatMap((tab) => {
        const range = readRange(tab, tabs);
        return range ? [{ tab, range }] : [];
      });
      onProgress?.({ step: 'values', tabs: reads.map((r) => r.tab.title) });
      const values = await client.readRanges(
        spreadsheet.id,
        reads.map((r) => r.range)
      );
      const valuesById = new Map(reads.map((r, i) => [r.tab.sheetId, values[i] ?? []]));
      return parseSpreadsheet(tabs, valuesById);
    },
  };
}

export function googleIngest(client: SheetsClient): Ingest<SpreadsheetRef> {
  return {
    id: 'google',
    label: 'Google Sheet',
    open: async (spreadsheet) => googleConnection(client, spreadsheet),
  };
}

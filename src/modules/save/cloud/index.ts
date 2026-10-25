import type { SheetsClient } from '../../../lib/google/sheetsClient';
import type { Saver } from '../types';
import { saveRequests } from './requests';

/**
 * Saves to a Google Sheet. Every change since the last save goes into a single `batchUpdate`,
 * which Google applies atomically. Changed account tabs are rewritten whole, in date order, with
 * fresh Total formulas, so the running balance is always right.
 */
export function cloudSaver(client: SheetsClient, spreadsheetId: string): Saver {
  return {
    id: 'cloud',
    async save(base, next) {
      const { requests, layout } = saveRequests(base, next);
      await client.batchUpdate(spreadsheetId, requests);
      return { data: next, skippedTabs: base.skippedTabs, tabReports: base.tabReports, layout };
    },
  };
}

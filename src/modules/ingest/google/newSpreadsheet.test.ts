import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../../../lib/domain/defaults';
import { createLedgerSpreadsheet, newSpreadsheetBody } from './newSpreadsheet';
import { projectNumberFromClientId } from './picker';
import type { SheetsClient } from '../../../lib/google/sheetsClient';
import type { NewSpreadsheet } from '../../../lib/google/sheetsTypes';

describe('newSpreadsheetBody', () => {
  it('has one account tab with the standard header and a metadata tab', () => {
    const body = newSpreadsheetBody('My money');
    expect(body.sheets.map((s) => s.properties.title)).toEqual([
      'Current account',
      'Ledger_Metadata',
    ]);
    const header = body.sheets[0]?.data?.[0]?.rowData[0]?.values.map(
      (c) => c.userEnteredValue?.stringValue
    );
    expect(header).toEqual(['Date', 'Category', 'Amount', 'Note', 'Total']);
    expect(body.sheets[1]?.data?.[0]?.rowData).toHaveLength(
      1 + DEFAULT_CATEGORIES.length + DEFAULT_CATEGORIES.filter((c) => c.excluded).length
    );
  });

  it('falls back to a default title', async () => {
    let sent: NewSpreadsheet | undefined;
    const client = {
      create: async (body: NewSpreadsheet) => {
        sent = body;
        return { spreadsheetId: 'id', title: body.properties.title };
      },
    } as unknown as SheetsClient;
    expect(await createLedgerSpreadsheet(client, '   ')).toEqual({ id: 'id', title: 'Ledger' });
    expect(sent?.properties.title).toBe('Ledger');
  });
});

describe('projectNumberFromClientId', () => {
  it('reads the numeric prefix', () => {
    expect(projectNumberFromClientId('123456789-abc.apps.googleusercontent.com')).toBe('123456789');
    expect(() => projectNumberFromClientId('nope')).toThrow();
  });
});

/**
 * The small slice of the Google Sheets API v4 types that Ledger uses.
 * Reference: https://developers.google.com/workspace/sheets/api/reference/rest
 */

import { z } from 'zod';

export interface ExtendedValue {
  numberValue?: number;
  stringValue?: string;
  boolValue?: boolean;
  formulaValue?: string;
}

export interface CellFormat {
  numberFormat?: { type: 'DATE' | 'NUMBER' | 'CURRENCY' | 'TEXT'; pattern?: string };
  textFormat?: { bold?: boolean };
}

export interface CellData {
  userEnteredValue?: ExtendedValue;
  userEnteredFormat?: CellFormat;
}

export interface RowData {
  values: CellData[];
}

/** Zero-based, end-exclusive. Omitted bounds are unbounded. */
export interface GridRange {
  sheetId: number;
  startRowIndex?: number;
  endRowIndex?: number;
  startColumnIndex?: number;
  endColumnIndex?: number;
}

export const sheetPropertiesSchema = z.object({
  sheetId: z.number().int(),
  title: z.string(),
  index: z.number().int(),
  gridProperties: z
    .object({
      rowCount: z.number().optional(),
      columnCount: z.number().optional(),
      frozenRowCount: z.number().optional(),
    })
    .optional(),
});
export type SheetProperties = z.infer<typeof sheetPropertiesSchema>;

export const spreadsheetMetadataSchema = z.object({
  spreadsheetId: z.string(),
  properties: z.object({ title: z.string() }),
  sheets: z.array(z.object({ properties: sheetPropertiesSchema })).default([]),
});
export type SpreadsheetMetadata = z.infer<typeof spreadsheetMetadataSchema>;

/**
 * One entry of a `spreadsheets.batchUpdate` request. Kept as a loose record of the request kinds
 * we send; the API validates the details.
 */
export type SheetsRequest =
  | { addSheet: { properties: Partial<SheetProperties> } }
  | { deleteSheet: { sheetId: number } }
  | { updateSheetProperties: { properties: Partial<SheetProperties>; fields: string } }
  | { appendDimension: { sheetId: number; dimension: 'ROWS' | 'COLUMNS'; length: number } }
  | {
      deleteDimension: {
        range: {
          sheetId: number;
          dimension: 'ROWS' | 'COLUMNS';
          startIndex: number;
          endIndex: number;
        };
      };
    }
  | {
      updateCells: {
        rows: RowData[];
        fields: string;
        start?: { sheetId: number; rowIndex: number; columnIndex: number };
        range?: GridRange;
      };
    }
  | {
      findReplace: {
        find: string;
        replacement: string;
        matchCase: boolean;
        matchEntireCell: boolean;
        range: GridRange;
      };
    };

/** Body of `spreadsheets.create`. */
export interface NewSpreadsheet {
  properties: { title: string; locale?: string };
  sheets: {
    properties: Partial<SheetProperties>;
    data?: { startRow: number; startColumn: number; rowData: RowData[] }[];
  }[];
}

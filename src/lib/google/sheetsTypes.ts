/**
 * The small slice of the Google Sheets API v4 types that Ledger uses.
 * Reference: https://developers.google.com/workspace/sheets/api/reference/rest
 */

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

export interface SheetProperties {
  sheetId: number;
  title: string;
  index: number;
  gridProperties?: { rowCount?: number; columnCount?: number; frozenRowCount?: number };
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  properties: { title: string };
  sheets: { properties: SheetProperties }[];
}

/**
 * One entry of a `spreadsheets.batchUpdate` request. Kept as a loose record of the request kinds
 * we send; the API validates the details.
 */
export type SheetsRequest =
  | { addSheet: { properties: Partial<SheetProperties> } }
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

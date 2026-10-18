import type { Workbook } from 'exceljs';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** ExcelJS is large, so it is only fetched when a file is opened or downloaded. */
export async function newWorkbook(): Promise<Workbook> {
  const exceljs = await import('exceljs');
  const Constructor = exceljs.Workbook ?? exceljs.default.Workbook;
  return new Constructor();
}

export async function loadWorkbook(bytes: ArrayBuffer | Uint8Array): Promise<Workbook> {
  const workbook = await newWorkbook();
  try {
    await workbook.xlsx.load(bytes as ArrayBuffer);
  } catch {
    throw new Error('That does not look like an .xlsx spreadsheet.');
  }
  return workbook;
}

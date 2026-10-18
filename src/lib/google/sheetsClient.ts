import type { GridRange, NewSpreadsheet, SheetsRequest, SpreadsheetMetadata } from './sheetsTypes';

/**
 * A thin, typed wrapper around the Sheets REST API. It knows URLs and auth headers, nothing about
 * Ledger's sheet format. the Google ingest and the cloud saver build on it.
 */
export interface SheetsClient {
  getMetadata(spreadsheetId: string): Promise<SpreadsheetMetadata>;
  /** Unformatted values (dates as serial numbers) for each range, in the same order. */
  readRanges(spreadsheetId: string, ranges: GridRange[]): Promise<unknown[][][]>;
  batchUpdate(spreadsheetId: string, requests: SheetsRequest[]): Promise<void>;
  create(spreadsheet: NewSpreadsheet): Promise<{ spreadsheetId: string; title: string }>;
}

export class GoogleApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
  }

  /** The token is missing, expired or revoked: the user must sign in again. */
  get isAuthError(): boolean {
    return this.status === 401;
  }

  /** The signed-in account cannot open this spreadsheet (or it was deleted). */
  get isNotAccessible(): boolean {
    return this.status === 403 || this.status === 404;
  }
}

export interface AccessTokenProvider {
  /** A valid access token. `forceRefresh` asks for a new one after the API rejected the last. */
  getAccessToken(options?: { forceRefresh?: boolean }): Promise<string>;
}

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export class HttpSheetsClient implements SheetsClient {
  private readonly auth: AccessTokenProvider;
  private readonly fetchImpl: typeof fetch;

  constructor(auth: AccessTokenProvider, fetchImpl: typeof fetch = (...args) => fetch(...args)) {
    this.auth = auth;
    this.fetchImpl = fetchImpl;
  }

  async getMetadata(spreadsheetId: string): Promise<SpreadsheetMetadata> {
    const fields =
      'spreadsheetId,properties.title,sheets.properties(sheetId,title,index,gridProperties)';
    return this.request(`${BASE}/${enc(spreadsheetId)}?fields=${encodeURIComponent(fields)}`);
  }

  async readRanges(spreadsheetId: string, ranges: GridRange[]): Promise<unknown[][][]> {
    if (ranges.length === 0) return [];
    const response = await this.request<{
      valueRanges?: {
        valueRange?: { values?: unknown[][] };
        dataFilters?: { gridRange?: GridRange }[];
      }[];
    }>(`${BASE}/${enc(spreadsheetId)}/values:batchGetByDataFilter`, {
      method: 'POST',
      body: {
        dataFilters: ranges.map((gridRange) => ({ gridRange })),
        majorDimension: 'ROWS',
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
      },
    });
    // Each matched range echoes the filter that matched it; map results back to request order.
    const matched = response.valueRanges ?? [];
    return ranges.map((range, i) => {
      const hit =
        matched.find((m) => m.dataFilters?.some((f) => sameRange(f.gridRange, range))) ??
        (matched.length === ranges.length ? matched[i] : undefined);
      return hit?.valueRange?.values ?? [];
    });
  }

  async batchUpdate(spreadsheetId: string, requests: SheetsRequest[]): Promise<void> {
    if (requests.length === 0) return;
    await this.request(`${BASE}/${enc(spreadsheetId)}:batchUpdate`, {
      method: 'POST',
      body: { requests, includeSpreadsheetInResponse: false },
    });
  }

  async create(spreadsheet: NewSpreadsheet): Promise<{ spreadsheetId: string; title: string }> {
    const created = await this.request<SpreadsheetMetadata>(
      `${BASE}?fields=${encodeURIComponent('spreadsheetId,properties.title')}`,
      { method: 'POST', body: spreadsheet }
    );
    return { spreadsheetId: created.spreadsheetId, title: created.properties.title };
  }

  private async request<T>(
    url: string,
    init: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    let response = await this.send(url, init, false);
    // A token can expire between our check and Google's; retry once with a fresh one.
    if (response.status === 401) response = await this.send(url, init, true);
    if (!response.ok) throw new GoogleApiError(response.status, await errorMessage(response));
    return (await response.json()) as T;
  }

  private async send(
    url: string,
    init: { method?: string; body?: unknown },
    forceRefresh: boolean
  ) {
    const token = await this.auth.getAccessToken({ forceRefresh });
    return this.fetchImpl(url, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  }
}

function enc(id: string): string {
  return encodeURIComponent(id);
}

function sameRange(a: GridRange | undefined, b: GridRange): boolean {
  if (!a) return false;
  const keys = [
    'sheetId',
    'startRowIndex',
    'endRowIndex',
    'startColumnIndex',
    'endColumnIndex',
  ] as const;
  return keys.every((k) => (a[k] ?? null) === (b[k] ?? null));
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body.error?.message) return body.error.message;
  } catch {
    // Not JSON; fall through.
  }
  return `Google Sheets request failed (${response.status})`;
}

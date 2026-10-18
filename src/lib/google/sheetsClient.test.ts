import { describe, expect, it, vi } from 'vitest';
import { GoogleApiError, HttpSheetsClient, UnexpectedResponseError } from './sheetsClient';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HttpSheetsClient', () => {
  it('sends the bearer token and retries once with a fresh token on 401', async () => {
    const tokens = ['old', 'new'];
    const auth = { getAccessToken: vi.fn(async () => tokens.shift() ?? 'none') };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(
        json(200, { spreadsheetId: 'x', properties: { title: 'T' }, sheets: [] })
      );
    const client = new HttpSheetsClient(auth, fetchImpl);
    const metadata = await client.getMetadata('x');
    expect(metadata.properties.title).toBe('T');
    expect(auth.getAccessToken).toHaveBeenLastCalledWith({ forceRefresh: true });
    const headers = fetchImpl.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer new');
  });

  it('explains a reply that does not have the documented shape', async () => {
    const auth = { getAccessToken: async () => 't' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json(200, { spreadsheetId: 'x', sheets: [{ properties: { title: 1 } }] }));
    const error = await new HttpSheetsClient(auth, fetchImpl)
      .getMetadata('x')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect((error as Error).message).toMatch(/does not understand/);
  });

  it('surfaces Google error messages with the status', async () => {
    const auth = { getAccessToken: async () => 't' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json(404, { error: { message: 'Requested entity was not found.' } }));
    const error = await new HttpSheetsClient(auth, fetchImpl)
      .getMetadata('gone')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GoogleApiError);
    expect((error as GoogleApiError).isNotAccessible).toBe(true);
    expect((error as GoogleApiError).message).toBe('Requested entity was not found.');
  });

  it('maps data-filter reads back to request order', async () => {
    const auth = { getAccessToken: async () => 't' };
    const a = { sheetId: 1, startRowIndex: 1 };
    const b = { sheetId: 2, startRowIndex: 1 };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      json(200, {
        valueRanges: [
          { valueRange: { values: [['b']] }, dataFilters: [{ gridRange: b }] },
          { valueRange: {}, dataFilters: [{ gridRange: a }] },
        ],
      })
    );
    const values = await new HttpSheetsClient(auth, fetchImpl).readRanges('x', [a, b]);
    expect(values).toEqual([[], [['b']]]);
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body.valueRenderOption).toBe('UNFORMATTED_VALUE');
    expect(body.dateTimeRenderOption).toBe('SERIAL_NUMBER');
  });
});

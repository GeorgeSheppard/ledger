import { describe, expect, it } from 'vitest';
import { exampleLedger } from '.';

describe('exampleLedger', () => {
  it('opens with accounts, transactions and paychecks and can be downloaded as a spreadsheet', async () => {
    const connection = exampleLedger();
    const { data } = await connection.load();
    expect(connection.title).toBe('Example ledger');
    expect(data.accounts.length).toBeGreaterThan(1);
    expect(data.rows[data.accounts[0]!.id]!.length).toBeGreaterThan(10);
    expect(data.paychecks).not.toBeNull();
    const file = await connection.saver.download?.(data);
    expect(file?.name).toMatch(/\.xlsx$/);
  });
});

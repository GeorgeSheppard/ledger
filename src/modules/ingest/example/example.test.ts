import { describe, expect, it } from 'vitest';
import { exampleLedger } from '.';

describe('exampleLedger', () => {
  it('is a full year of activity that can be downloaded as a spreadsheet', async () => {
    const connection = exampleLedger();
    const { data } = await connection.load();
    expect(connection.title).toBe('Example ledger');
    expect(data.accounts).toHaveLength(3);
    expect(data.categories.length).toBeGreaterThanOrEqual(20);
    const total = Object.values(data.rows).reduce((sum, rows) => sum + rows.length, 0);
    expect(total).toBeGreaterThan(400);
    expect(data.paychecks).not.toBeNull();
    expect(connection.title).toBe('Example ledger');
    const file = await connection.saver.download?.(data);
    expect(file?.name).toMatch(/\.xlsx$/);
  });

  it('uses only categories it defines, and each month the card payment matches the spending', async () => {
    const { data } = await exampleLedger().load();
    const known = new Set(['', ...data.categories.map((category) => category.name)]);
    const rows = Object.values(data.rows).flat();
    expect(rows.filter((row) => !known.has(row.category))).toEqual([]);
    const net = (name: string) =>
      Object.values(data.rows)
        .flat()
        .filter((row) => row.category === name)
        .reduce((sum, row) => sum + row.amount, 0);
    expect(Math.abs(net('Card payment'))).toBeLessThan(0.01);
    expect(Math.abs(net('Savings'))).toBeLessThan(0.01);
  });
});

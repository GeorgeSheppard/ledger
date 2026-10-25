import { describe, expect, it } from 'vitest';
import { cachedLedgerSchema, ledgerDataSchema } from './schemas';
import { EMPTY_LAYOUT } from './remote';

const data = {
  accounts: [{ id: 7, name: 'Current' }],
  rows: { 7: [{ date: '2026-01-02', category: 'Food', amount: -4.5, note: '' }] },
  categories: [{ name: 'Food', color: '#112233' }],
  paychecks: { version: 1, paychecks: [] },
};

describe('store schemas', () => {
  it('accepts a working copy as it comes back from IndexedDB', () => {
    const stored = structuredClone({
      saved: { data, skippedTabs: [], tabReports: [], layout: EMPTY_LAYOUT },
      current: data,
    });
    expect(cachedLedgerSchema.safeParse(stored).success).toBe(true);
  });

  it('rejects data that no longer fits the shape', () => {
    expect(ledgerDataSchema.safeParse({ ...data, accounts: [{ id: 'x', name: 1 }] }).success).toBe(
      false
    );
    expect(cachedLedgerSchema.safeParse({ current: data }).success).toBe(false);
    expect(cachedLedgerSchema.safeParse(undefined).success).toBe(false);
  });

  it('blanks an invalid category colour', () => {
    const parsed = ledgerDataSchema.parse({
      ...data,
      categories: [{ name: 'Food', color: 'red' }],
    });
    expect(parsed.categories[0]?.color).toBe('');
  });
});

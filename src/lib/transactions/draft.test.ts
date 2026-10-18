import { describe, expect, it } from 'vitest';
import { draftFromTransaction, emptyDraft, isDraftDirty, validateDraft } from './draft';

describe('transaction drafts', () => {
  it('round-trips a transaction', () => {
    const draft = draftFromTransaction({
      id: '1:2',
      accountId: 1,
      row: 2,
      date: '2026-10-01',
      category: 'Rent',
      amount: -1100,
      note: 'Monthly rent',
      total: 0,
    });
    expect(validateDraft(draft)).toEqual({
      ok: true,
      input: { date: '2026-10-01', category: 'Rent', amount: -1100, note: 'Monthly rent' },
    });
  });

  it('trims text and parses the amount', () => {
    const result = validateDraft({
      date: '2026-10-01',
      category: ' Groceries ',
      amount: '£1,000.10-',
      note: ' Big shop ',
    });
    expect(result).toEqual({
      ok: true,
      input: { date: '2026-10-01', category: 'Groceries', amount: -1000.1, note: 'Big shop' },
    });
  });

  it('reports field errors', () => {
    const result = validateDraft({ ...emptyDraft('bad'), amount: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['amount', 'date']);
    const zero = validateDraft({ ...emptyDraft('2026-01-01'), amount: '0' });
    expect(zero.ok).toBe(false);
  });

  it('detects unsaved changes', () => {
    const start = emptyDraft('2026-01-01');
    expect(isDraftDirty({ ...start, note: '  ' }, start)).toBe(false);
    expect(isDraftDirty({ ...start, note: 'x' }, start)).toBe(true);
  });
});

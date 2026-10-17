import { describe, expect, it } from 'vitest';
import { reconcile } from './reconcile';

describe('reconcile', () => {
  const existing = [
    { date: '2026-03-05', amount: -2.5, note: 'Coffee' },
    { date: '2026-03-06', amount: -10, note: 'Lunch' },
  ];

  it('matches on date, amount and note, ignoring case and spacing', () => {
    expect(
      reconcile(
        [
          { date: '2026-03-05', amount: -2.5, note: '  coffee ' },
          { date: '2026-03-05', amount: -2.51, note: 'Coffee' },
          { date: '2026-03-07', amount: -10, note: 'Lunch' },
          { date: '2026-03-06', amount: -10, note: 'Lunch' },
        ],
        existing
      )
    ).toEqual(['existing', 'new', 'new', 'existing']);
  });

  it('matches one-to-one so repeated identical rows are kept', () => {
    const coffee = { date: '2026-03-05', amount: -2.5, note: 'Coffee' };
    expect(reconcile([coffee, coffee, coffee], existing)).toEqual(['existing', 'new', 'new']);
  });

  it('treats float noise as the same amount', () => {
    expect(
      reconcile(
        [{ date: '2026-03-05', amount: 0.1 + 0.2, note: 'x' }],
        [{ date: '2026-03-05', amount: 0.3, note: 'x' }]
      )
    ).toEqual(['existing']);
  });
});

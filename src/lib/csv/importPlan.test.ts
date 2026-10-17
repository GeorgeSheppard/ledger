import { describe, expect, it } from 'vitest';
import type { Transaction } from '../domain/types';
import { buildImportPlan, withNewCategories } from './importPlan';
import { guessMapping, toTable } from './mapping';
import { parseCsv } from './parse';

describe('buildImportPlan', () => {
  const existing: Transaction[] = [
    {
      id: '1:2',
      accountId: 1,
      row: 2,
      date: '2026-03-05',
      category: 'Groceries',
      amount: -12.4,
      note: 'Tesco',
      total: -12.4,
    },
  ];
  const categories = [{ name: 'Groceries', color: '#000000' }];
  const table = toTable(
    parseCsv(
      [
        'Date,Description,Amount,Category',
        '07/03/2026,Pret,-4.20,Eating out',
        '06/03/2026,Sainsburys,-20.00,groceries',
        '05/03/2026,Tesco,-12.40,Groceries',
        'bad,Tesco,-1,',
      ].join('\n')
    )
  );

  it('splits rows into new, existing and invalid and sorts what to add', () => {
    const plan = buildImportPlan(table, guessMapping(table), existing, categories);
    expect(plan.problems).toEqual([]);
    expect(plan.rows.map((r) => r.status)).toEqual(['new', 'new', 'existing', 'invalid']);
    expect(plan.counts).toEqual({ new: 2, existing: 1, invalid: 1 });
    expect(plan.toAdd).toEqual([
      { date: '2026-03-06', amount: -20, note: 'Sainsburys', category: 'Groceries' },
      { date: '2026-03-07', amount: -4.2, note: 'Pret', category: 'Eating out' },
    ]);
    expect(plan.newCategories).toEqual(['Eating out']);
  });

  it('returns only the problems when the mapping is unusable', () => {
    const plan = buildImportPlan(table, { ...guessMapping(table), date: null }, existing, []);
    expect(plan.rows).toEqual([]);
    expect(plan.toAdd).toEqual([]);
    expect(plan.problems).toHaveLength(1);
  });

  it('appends new categories with colours', () => {
    const result = withNewCategories(categories, ['Eating out']);
    expect(result).toHaveLength(2);
    expect(result[1]?.name).toBe('Eating out');
    expect(result[1]?.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

import { describe, expect, it } from 'vitest';
import {
  CATEGORY_PALETTE,
  colorDistance,
  nextCategoryColor,
  respreadColors,
  stableCategoryColor,
} from './palette';

describe('category palette', () => {
  it('has no two colours that look alike', () => {
    for (const [i, a] of CATEGORY_PALETTE.entries())
      for (const b of CATEGORY_PALETTE.slice(i + 1))
        expect(colorDistance(a, b), `${a} vs ${b}`).toBeGreaterThan(0.08);
  });

  it('measures identical colours as 0 and black vs white as far apart', () => {
    expect(colorDistance('#4f7cff', '#4F7CFF')).toBe(0);
    expect(colorDistance('#000000', '#ffffff')).toBeGreaterThan(0.9);
  });

  it('skips palette colours that are close to one already taken', () => {
    const almostFirst = '#249483';
    const picked = nextCategoryColor([{ name: 'a', color: almostFirst }]);
    expect(colorDistance(picked, almostFirst)).toBeGreaterThan(0.08);
  });

  it('gives every category in a long list a colour, and stays stable per name', () => {
    const names = Array.from({ length: 30 }, (_, i) => `c${i}`);
    const taken = new Set<string>();
    for (const name of names) taken.add(stableCategoryColor(name, taken));
    expect(taken.size).toBeGreaterThan(CATEGORY_PALETTE.length - 1);
    expect(stableCategoryColor('Pets')).toBe(stableCategoryColor(' pets '));
  });

  it('respreads colours without changing anything else', () => {
    const before = [
      { name: 'A', color: '#4f7cff', excluded: true },
      { name: 'B', color: '#4f7cfe' },
      { name: 'C', color: '#4f7cfd' },
    ];
    const after = respreadColors(before);
    expect(after.map((c) => c.name)).toEqual(['A', 'B', 'C']);
    expect(after[0]?.excluded).toBe(true);
    expect(colorDistance(after[0]!.color, after[1]!.color)).toBeGreaterThan(0.08);
    expect(colorDistance(after[1]!.color, after[2]!.color)).toBeGreaterThan(0.08);
  });
});

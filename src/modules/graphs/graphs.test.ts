import { describe, expect, it } from 'vitest';
import { GRAPHS } from '.';

describe('graph registry', () => {
  it('has one graph per kind', () => {
    const kinds = GRAPHS.map((g) => g.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toContain('sankey');
  });

  it('gives every graph a title and a width on the 4-column grid', () => {
    for (const graph of GRAPHS) {
      expect(graph.title).not.toBe('');
      expect([1, 2, 3, 4]).toContain(graph.width);
    }
  });
});

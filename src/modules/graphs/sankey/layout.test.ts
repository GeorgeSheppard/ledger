import { describe, expect, it } from 'vitest';
import { layoutSankey, linkPath } from './layout';

const nodes = [
  { id: 'gross', column: 0 },
  { id: 'tax', column: 1 },
  { id: 'net', column: 1 },
  { id: 'rent', column: 2 },
  { id: 'saved', column: 2 },
];
const links = [
  { source: 'gross', target: 'tax', value: 20 },
  { source: 'gross', target: 'net', value: 80 },
  { source: 'net', target: 'rent', value: 50 },
  { source: 'net', target: 'saved', value: 30 },
];
const options = { width: 400, height: 200, nodeWidth: 10, nodePadding: 20 };

describe('layoutSankey', () => {
  const layout = layoutSankey(nodes, links, options);
  const node = (id: string) => layout.nodes.find((n) => n.id === id)!;

  it('sizes nodes by the money through them on one scale', () => {
    expect(node('gross').value).toBe(100);
    expect(node('net').height / node('tax').height).toBeCloseTo(4);
    // Column 1 has one gap, so its two nodes share 180px.
    expect(node('tax').height + node('net').height).toBeCloseTo(180);
    expect(node('gross').height).toBeCloseTo(180);
  });

  it('puts columns left to right, keeping nodes inside the box', () => {
    expect(node('gross').x).toBe(0);
    expect(node('rent').x).toBe(390);
    for (const n of layout.nodes) {
      expect(n.y).toBeGreaterThanOrEqual(-1e-9);
      expect(n.y + n.height).toBeLessThanOrEqual(200 + 1e-9);
    }
  });

  it('stacks ribbons within their nodes, as wide as the money they carry', () => {
    const toNet = layout.links.find((l) => l.target === 'net')!;
    const toTax = layout.links.find((l) => l.target === 'tax')!;
    expect(toNet.width / toTax.width).toBeCloseTo(4);
    expect(toNet.x0).toBe(10);
    expect(toNet.x1).toBe(node('net').x);
    const gross = node('gross');
    for (const l of [toNet, toTax]) {
      expect(l.y0 - l.width / 2).toBeGreaterThanOrEqual(gross.y - 1e-9);
      expect(l.y0 + l.width / 2).toBeLessThanOrEqual(gross.y + gross.height + 1e-9);
    }
    // Ribbons leave top to bottom in the order of their targets.
    expect(toTax.y0).toBeLessThan(toNet.y0);
  });

  it('ignores empty links and unknown nodes', () => {
    const l = layoutSankey(
      [
        { id: 'a', column: 0 },
        { id: 'b', column: 1 },
      ],
      [
        { source: 'a', target: 'b', value: 0 },
        { source: 'a', target: 'zzz', value: 5 },
      ],
      options
    );
    expect(l.links).toEqual([]);
    expect(l.nodes).toHaveLength(2);
  });

  it('draws a curve between the ends', () => {
    expect(linkPath({ x0: 0, y0: 10, x1: 100, y1: 50 })).toBe('M0,10C50,10 50,50 100,50');
  });
});

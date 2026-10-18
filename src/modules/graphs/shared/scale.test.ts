import { describe, expect, it } from 'vitest';
import { bandCenter, barPath, linearScale } from './scale';

describe('linearScale ticks', () => {
  it('picks round steps covering the range', () => {
    expect(linearScale(0, 9300, 0, 1).ticks).toEqual([0, 2000, 4000, 6000, 8000, 10000]);
    expect(linearScale(9100, 13800, 0, 1).ticks).toEqual([9000, 10000, 11000, 12000, 13000, 14000]);
  });

  it('includes zero for ranges crossing it', () => {
    expect(linearScale(-1800, 2900, 0, 1).ticks).toContain(0);
  });

  it('handles flat data', () => {
    expect(linearScale(0, 0, 0, 1).domain).toEqual([0, 1]);
    expect(linearScale(500, 500, 0, 1).domain[0]).toBe(0);
  });
});

describe('linearScale', () => {
  it('maps the nice domain onto the range', () => {
    const y = linearScale(0, 90, 200, 0);
    expect(y.domain).toEqual([0, 100]);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
  });
});

describe('bandCenter', () => {
  it('centres slots', () => {
    expect(bandCenter(0, 4, 0, 100)).toBe(12.5);
    expect(bandCenter(3, 4, 0, 100)).toBe(87.5);
  });
});

describe('barPath', () => {
  it('is empty for zero-height bars', () => {
    expect(barPath(0, 10, 50, 50)).toBe('');
  });

  it('rounds the tip, not the baseline', () => {
    expect(barPath(0, 10, 100, 20)).toBe('M0,100 V24 Q0,20 4,20 H6 Q10,20 10,24 V100 Z');
    expect(barPath(0, 10, 100, 180)).toBe('M0,100 V176 Q0,180 4,180 H6 Q10,180 10,176 V100 Z');
  });
});

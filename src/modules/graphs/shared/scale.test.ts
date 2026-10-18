import { describe, expect, it } from 'vitest';
import { bandCenter, barPath, linearScale, niceTicks } from './scale';

describe('niceTicks', () => {
  it('picks round steps covering the range', () => {
    expect(niceTicks(0, 9300)).toEqual([0, 2500, 5000, 7500, 10000]);
    expect(niceTicks(9100, 13800)).toEqual([8000, 10000, 12000, 14000]);
  });

  it('includes zero for ranges crossing it', () => {
    expect(niceTicks(-1800, 2900)).toContain(0);
  });

  it('handles flat data', () => {
    expect(niceTicks(0, 0)).toEqual([0, 1]);
    expect(niceTicks(500, 500)[0]).toBe(0);
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

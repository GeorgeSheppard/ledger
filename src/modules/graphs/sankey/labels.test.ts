import { describe, expect, it } from 'vitest';
import { placeLabels } from './labels';

describe('placeLabels', () => {
  it('keeps labels that do not collide on the first lane, centred under their nodes', () => {
    const placed = placeLabels(
      [
        { id: 'a', center: 50, width: 40 },
        { id: 'b', center: 200, width: 60 },
      ],
      300,
      3
    );
    expect(placed).toEqual([
      { id: 'a', x: 30, lane: 0 },
      { id: 'b', x: 170, lane: 0 },
    ]);
  });

  it('moves a colliding label to the next lane, and drops it when no lane is free', () => {
    const boxes = [
      { id: 'a', center: 100, width: 80 },
      { id: 'b', center: 110, width: 80 },
      { id: 'c', center: 120, width: 80 },
    ];
    expect(placeLabels(boxes, 300, 3).map((l) => l.lane)).toEqual([0, 1, 2]);
    expect(placeLabels(boxes, 300, 2).map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('keeps labels inside the drawing', () => {
    const [left, right] = placeLabels(
      [
        { id: 'l', center: 5, width: 60 },
        { id: 'r', center: 295, width: 60 },
      ],
      300,
      1
    );
    expect(left!.x).toBe(0);
    expect(right!.x).toBe(240);
  });
});

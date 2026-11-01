/**
 * Labels for a vertical Sankey, where the nodes of a column sit side by side and their names would
 * collide. Each label goes under its node, on the first row (lane) where it fits; a node whose label
 * fits on no lane gets none (its amount is still read out when it is tapped).
 */

export interface LabelBox {
  id: string;
  /** Centre of the node, across the drawing. */
  center: number;
  /** Estimated width of the label's text. */
  width: number;
}

export interface PlacedLabel {
  id: string;
  /** Left edge of the text. */
  x: number;
  lane: number;
}

const GAP = 6;

export function placeLabels(
  boxes: readonly LabelBox[],
  drawingWidth: number,
  maxLanes: number
): PlacedLabel[] {
  /** Right edge of the last label put on each lane. */
  const ends: number[] = [];
  const placed: PlacedLabel[] = [];
  for (const box of [...boxes].sort((a, b) => a.center - b.center)) {
    const x = Math.min(
      Math.max(box.center - box.width / 2, 0),
      Math.max(drawingWidth - box.width, 0)
    );
    let lane = ends.findIndex((end) => x >= end + GAP);
    if (lane === -1 && ends.length < maxLanes) lane = ends.length;
    if (lane === -1) continue;
    ends[lane] = x + box.width;
    placed.push({ id: box.id, x, lane });
  }
  return placed;
}

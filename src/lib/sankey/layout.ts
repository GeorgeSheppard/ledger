/**
 * Lays out a Sankey diagram: nodes in columns, sized by the money through them, joined by ribbons
 * as wide as the money they carry. Pure geometry with no drawing, so it can be tested.
 */

export interface SankeyNodeInput {
  id: string;
  /** Left to right, from 0. Nodes in a column keep the order they are given in. */
  column: number;
}

export interface SankeyLinkInput {
  source: string;
  target: string;
  value: number;
}

export interface SankeyOptions {
  width: number;
  height: number;
  nodeWidth?: number;
  /** Vertical gap between nodes in a column. */
  nodePadding?: number;
  /** Nodes never get thinner than this, so tiny amounts stay visible. */
  minNodeHeight?: number;
}

export interface LaidNode {
  id: string;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The money through the node: the larger of what flows in and what flows out. */
  value: number;
}

export interface LaidLink {
  source: string;
  target: string;
  value: number;
  /** Where the ribbon's centre line leaves the source and enters the target. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Ribbon thickness. */
  width: number;
}

export interface SankeyLayout {
  nodes: LaidNode[];
  links: LaidLink[];
}

export function layoutSankey(
  nodes: readonly SankeyNodeInput[],
  links: readonly SankeyLinkInput[],
  { width, height, nodeWidth = 14, nodePadding = 14, minNodeHeight = 2 }: SankeyOptions
): SankeyLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const real = links.filter((l) => l.value > 0 && byId.has(l.source) && byId.has(l.target));
  const columnCount = Math.max(1, ...nodes.map((n) => n.column + 1));

  const inflow = new Map<string, number>();
  const outflow = new Map<string, number>();
  for (const l of real) {
    outflow.set(l.source, (outflow.get(l.source) ?? 0) + l.value);
    inflow.set(l.target, (inflow.get(l.target) ?? 0) + l.value);
  }
  const valueOf = (id: string) => Math.max(inflow.get(id) ?? 0, outflow.get(id) ?? 0);

  // One scale for the whole diagram: the tightest column decides how many pixels a unit gets.
  const columns: SankeyNodeInput[][] = Array.from({ length: columnCount }, () => []);
  for (const node of nodes) columns[node.column]!.push(node);
  let scale = Infinity;
  for (const column of columns) {
    const total = column.reduce((sum, n) => sum + valueOf(n.id), 0);
    if (total <= 0) continue;
    const room = height - Math.max(0, column.length - 1) * nodePadding;
    scale = Math.min(scale, Math.max(room, 1) / total);
  }
  if (!Number.isFinite(scale)) scale = 0;

  const laid = new Map<string, LaidNode>();
  columns.forEach((column, c) => {
    const heights = column.map((n) => Math.max(valueOf(n.id) * scale, minNodeHeight));
    const used = heights.reduce((a, b) => a + b, 0) + Math.max(0, column.length - 1) * nodePadding;
    let y = Math.max(0, (height - used) / 2);
    const x = columnCount === 1 ? 0 : (c * (width - nodeWidth)) / (columnCount - 1);
    column.forEach((n, i) => {
      laid.set(n.id, {
        id: n.id,
        column: n.column,
        x,
        y,
        width: nodeWidth,
        height: heights[i]!,
        value: valueOf(n.id),
      });
      y += heights[i]! + nodePadding;
    });
  });

  // Stack each node's ribbons top to bottom in the order of the node they connect to, which keeps
  // ribbons from crossing needlessly.
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  const centre = (id: string) => laid.get(id)!.y + laid.get(id)!.height / 2;
  const outOrder = [...real].sort((a, b) => centre(a.target) - centre(b.target));
  const inOrder = [...real].sort((a, b) => centre(a.source) - centre(b.source));
  const sourceY = new Map<SankeyLinkInput, number>();
  const targetY = new Map<SankeyLinkInput, number>();
  for (const l of outOrder) {
    const used = outgoing.get(l.source) ?? 0;
    sourceY.set(l, laid.get(l.source)!.y + used + (l.value * scale) / 2);
    outgoing.set(l.source, used + l.value * scale);
  }
  for (const l of inOrder) {
    const used = incoming.get(l.target) ?? 0;
    targetY.set(l, laid.get(l.target)!.y + used + (l.value * scale) / 2);
    incoming.set(l.target, used + l.value * scale);
  }

  return {
    nodes: nodes.map((n) => laid.get(n.id)!),
    links: real.map((l) => ({
      source: l.source,
      target: l.target,
      value: l.value,
      x0: laid.get(l.source)!.x + nodeWidth,
      y0: sourceY.get(l)!,
      x1: laid.get(l.target)!.x,
      y1: targetY.get(l)!,
      width: l.value * scale,
    })),
  };
}

/** SVG path for a ribbon's centre line; stroke it with the ribbon's width. */
export function linkPath(link: Pick<LaidLink, 'x0' | 'y0' | 'x1' | 'y1'>): string {
  const mid = (link.x0 + link.x1) / 2;
  return `M${link.x0},${link.y0}C${mid},${link.y0} ${mid},${link.y1} ${link.x1},${link.y1}`;
}

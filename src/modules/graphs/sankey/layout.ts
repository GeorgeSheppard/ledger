import { sankey } from 'd3-sankey';

/**
 * Lays out a Sankey diagram: nodes in columns, sized by the money through them, joined by ribbons
 * as wide as the money they carry. A thin adapter over d3-sankey; no drawing, so it can be tested.
 */

export interface SankeyNodeInput {
  id: string;
  /** Left to right, from 0. Nodes in a column are laid out largest first. */
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

interface SNode extends SankeyNodeInput {
  /** The id the d3 layout identifies the node by. */
  id: string;
}

export function layoutSankey(
  nodes: readonly SankeyNodeInput[],
  links: readonly SankeyLinkInput[],
  { width, height, nodeWidth = 14, nodePadding = 14, minNodeHeight = 2 }: SankeyOptions
): SankeyLayout {
  const columnOf = new Map(nodes.map((n) => [n.id, n.column]));
  // d3-sankey rejects links that do not go forward, and ignores nothing, so filter them here.
  const real = links.filter(
    (l) =>
      l.value > 0 &&
      columnOf.has(l.source) &&
      columnOf.has(l.target) &&
      columnOf.get(l.source)! < columnOf.get(l.target)!
  );

  const graph = sankey<SNode, SankeyLinkInput>()
    .nodeId((n) => n.id)
    // Columns are given, not inferred.
    .nodeAlign((n) => n.column)
    // Largest first within each column, so the biggest flows sit at the top.
    .nodeSort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .nodeWidth(nodeWidth)
    .nodePadding(nodePadding)
    .extent([
      [0, 0],
      [width, height],
    ])({
    nodes: nodes.map((n) => ({ ...n })),
    links: real.map((l) => ({ ...l })),
  });

  const laid = graph.nodes.map((n): LaidNode => ({
    id: n.id,
    column: n.column,
    x: n.x0 ?? 0,
    y: n.y0 ?? 0,
    width: nodeWidth,
    height: Math.max((n.y1 ?? 0) - (n.y0 ?? 0), minNodeHeight),
    value: n.value ?? 0,
  }));
  return {
    nodes: laid,
    links: graph.links.map((l) => {
      const source = l.source as SNode & { x1?: number };
      const target = l.target as SNode & { x0?: number };
      return {
        source: source.id,
        target: target.id,
        value: l.value,
        x0: source.x1 ?? 0,
        y0: l.y0 ?? 0,
        x1: target.x0 ?? 0,
        y1: l.y1 ?? 0,
        width: l.width ?? 0,
      };
    }),
  };
}

/** SVG path for a ribbon's centre line; stroke it with the ribbon's width. */
export function linkPath(link: Pick<LaidLink, 'x0' | 'y0' | 'x1' | 'y1'>): string {
  const mid = (link.x0 + link.x1) / 2;
  return `M${link.x0},${link.y0}C${mid},${link.y0} ${mid},${link.y1} ${link.x1},${link.y1}`;
}

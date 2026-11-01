import { sankey } from 'd3-sankey';

/**
 * Lays out a Sankey diagram: nodes in columns, sized by the money through them, joined by ribbons
 * as wide as the money they carry. Columns run left to right, or top to bottom (`vertical`) for
 * narrow screens, where there is height to spare and little width. A thin adapter over d3-sankey; no drawing, so it can be tested.
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
  /** The drawing's size in pixels, whichever way the columns run. */
  width: number;
  height: number;
  /** Which way the columns run; left to right by default. */
  orientation?: 'horizontal' | 'vertical';
  nodeWidth?: number;
  /** Gap between nodes in a column. */
  nodePadding?: number;
  /** Nodes never get thinner (along their column) than this, so tiny amounts stay visible. */
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
  /** Where the ribbon's centre line leaves the source and enters the target (drawing coordinates). */
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
  {
    width,
    height,
    orientation = 'horizontal',
    nodeWidth = 14,
    nodePadding = 14,
    minNodeHeight = 2,
  }: SankeyOptions
): SankeyLayout {
  const vertical = orientation === 'vertical';
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
    // d3 always lays columns along x; for a vertical diagram it works in a transposed box.
    .extent([[0, 0], vertical ? [height, width] : [width, height]])({
    nodes: nodes.map((n) => ({ ...n })),
    links: real.map((l) => ({ ...l })),
  });

  const laid = graph.nodes.map((n): LaidNode => {
    const length = Math.max((n.y1 ?? 0) - (n.y0 ?? 0), minNodeHeight);
    return {
      id: n.id,
      column: n.column,
      x: vertical ? (n.y0 ?? 0) : (n.x0 ?? 0),
      y: vertical ? (n.x0 ?? 0) : (n.y0 ?? 0),
      width: vertical ? length : nodeWidth,
      height: vertical ? nodeWidth : length,
      value: n.value ?? 0,
    };
  });
  return {
    nodes: laid,
    links: graph.links.map((l) => {
      const source = l.source as SNode & { x1?: number };
      const target = l.target as SNode & { x0?: number };
      const [from, to] = [source.x1 ?? 0, target.x0 ?? 0];
      return {
        source: source.id,
        target: target.id,
        value: l.value,
        x0: vertical ? (l.y0 ?? 0) : from,
        y0: vertical ? from : (l.y0 ?? 0),
        x1: vertical ? (l.y1 ?? 0) : to,
        y1: vertical ? to : (l.y1 ?? 0),
        width: l.width ?? 0,
      };
    }),
  };
}

/** SVG path for a ribbon's centre line; stroke it with the ribbon's width. */
export function linkPath(
  link: Pick<LaidLink, 'x0' | 'y0' | 'x1' | 'y1'>,
  orientation: 'horizontal' | 'vertical' = 'horizontal'
): string {
  if (orientation === 'vertical') {
    const mid = (link.y0 + link.y1) / 2;
    return `M${link.x0},${link.y0}C${link.x0},${mid} ${link.x1},${mid} ${link.x1},${link.y1}`;
  }
  const mid = (link.x0 + link.x1) / 2;
  return `M${link.x0},${link.y0}C${mid},${link.y0} ${mid},${link.y1} ${link.x1},${link.y1}`;
}

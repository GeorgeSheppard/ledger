import { useMemo, useState } from 'react';
import type { FlowKind, FlowNode, MoneyFlow } from '../../../lib/paychecks/flow';
import { layoutSankey, linkPath } from './layout';
import { formatMoney } from '../shared/format';
import { useElementWidth } from '../shared/useElementWidth';
import { FALLBACK_COLOR, INCOME_COLOR, SPENDING_COLOR } from '../shared/theme';

const NODE_WIDTH = 12;
const NODE_PADDING = 12;
const MIN_LINK_OPACITY = 0.3;

const KIND_COLORS: Record<Exclude<FlowKind, 'category'>, string> = {
  income: INCOME_COLOR,
  deduction: SPENDING_COLOR,
  takeHome: 'var(--color-accent)',
  gross: 'var(--color-accent)',
  benefit: 'var(--color-accent)',
  benefitValue: FALLBACK_COLOR,
  saved: INCOME_COLOR,
  other: FALLBACK_COLOR,
};

interface Hover {
  /** `node:<id>` or `link:<index>`. */
  key: string;
}

interface SankeyChartProps {
  flow: MoneyFlow;
  colorOf(category: string): string;
  /** Categories picked as the dashboard's filter; their nodes are outlined and the other spending is dimmed. */
  chosen?: readonly string[];
  /** Clicking a spending category node. Other nodes can't be filtered on, so do nothing. */
  onToggleCategory?(category: string): void;
}

/** A Sankey diagram of a `MoneyFlow`: ribbons as wide as the money they carry. */
export function SankeyChart({ flow, colorOf, chosen = [], onToggleCategory }: SankeyChartProps) {
  const [frame, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover | null>(null);

  const tallestColumn = Math.max(
    ...[0, 1, 2, 3].map((c) => flow.nodes.filter((n) => n.column === c).length)
  );
  const height = Math.min(560, Math.max(280, tallestColumn * 34 + 60));
  // The last column's labels sit to the right of its nodes, so they need room beside the chart.
  const labelRoom = width < 520 ? 96 : 140;
  const plotWidth = Math.max(120, width - labelRoom);

  const layout = useMemo(
    () =>
      layoutSankey(flow.nodes, flow.links, {
        width: plotWidth,
        height,
        nodeWidth: NODE_WIDTH,
        nodePadding: NODE_PADDING,
      }),
    [flow, plotWidth, height]
  );
  const nodeById = useMemo(() => new Map(flow.nodes.map((n) => [n.id, n])), [flow.nodes]);

  const colorOfNode = (node: FlowNode) =>
    node.kind === 'category' ? colorOf(node.category ?? node.label) : KIND_COLORS[node.kind];
  const isChosen = (node: FlowNode) =>
    node.kind === 'category' && chosen.includes(node.category ?? node.label);
  const filtering = chosen.length > 0;
  const labelOf = (id: string) => nodeById.get(id)?.label ?? id;

  const share = (value: number, of: number) =>
    of > 0 ? ` (${Math.round((value / of) * 100)}%)` : '';
  const nodeReadout = (id: string, value: number) => (
    <>
      <span className="font-medium">{labelOf(id)}</span> {formatMoney(value)}
      {nodeById.get(id)?.column === 3 ? share(value, flow.totals.takeHome) : ''}
    </>
  );
  const linkReadout = (source: string, target: string, value: number) => (
    <>
      <span className="font-medium">
        {labelOf(source)} → {labelOf(target)}
      </span>{' '}
      {formatMoney(value)}
      {source === 'takeHome' ? share(value, flow.totals.takeHome) : ''}
    </>
  );

  const track = (key: string) => () => setHover({ key });
  const clear = () => setHover(null);

  const hoveredLink = hover?.key.startsWith('link:')
    ? layout.links[Number(hover.key.slice(5))]
    : null;
  const hoveredNode = hover?.key.startsWith('node:')
    ? layout.nodes.find((n) => `node:${n.id}` === hover.key)
    : null;
  const touches = (id: string) =>
    hoveredNode &&
    (hoveredNode.id === id ||
      layout.links.some(
        (l) =>
          (l.source === hoveredNode.id && l.target === id) ||
          (l.target === hoveredNode.id && l.source === id)
      ));

  const linkOpacity = (index: number) => {
    const link = layout.links[index]!;
    const target = nodeById.get(link.target)!;
    if (filtering && target.kind === 'category') return isChosen(target) ? 0.65 : 0.08;
    if (hoveredLink) return hoveredLink === link ? 0.65 : 0.15;
    if (hoveredNode)
      return link.source === hoveredNode.id || link.target === hoveredNode.id ? 0.65 : 0.12;
    return MIN_LINK_OPACITY;
  };

  // A fixed line above the diagram says what is under the pointer, so no tooltip covers the graph.
  const readout = hoveredLink
    ? linkReadout(hoveredLink.source, hoveredLink.target, hoveredLink.value)
    : hoveredNode
      ? nodeReadout(hoveredNode.id, hoveredNode.value)
      : null;

  return (
    <div ref={frame} className="relative w-full" onMouseLeave={clear}>
      <p className="mb-2 min-h-5 text-sm tabular-nums" aria-hidden="true">
        {readout ?? <span className="text-muted">Point at a bar or ribbon to see its amount.</span>}
      </p>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block overflow-visible"
        role="img"
        aria-label={`Money flow: ${formatMoney(flow.totals.gross)} gross pay, ${formatMoney(flow.totals.deductions)} deducted, ${formatMoney(flow.totals.takeHome)} take-home, ${formatMoney(flow.totals.spending)} spent`}
      >
        <g fill="none">
          {layout.links.map((link, i) => {
            const target = nodeById.get(link.target)!;
            return (
              <path
                key={`${link.source}>${link.target}`}
                d={linkPath(link)}
                stroke={colorOfNode(target)}
                strokeWidth={Math.max(link.width, 1)}
                strokeOpacity={linkOpacity(i)}
                onMouseMove={track(`link:${i}`)}
                className="cursor-default"
              />
            );
          })}
        </g>
        {layout.nodes.map((laid) => {
          const node = nodeById.get(laid.id)!;
          const clickable = node.kind === 'category' && !!onToggleCategory;
          const selected = isChosen(node);
          const dim =
            (hoveredNode && !touches(laid.id)) ||
            (filtering && node.kind === 'category' && !selected);
          const lines = laid.height >= 28;
          const textY = laid.y + laid.height / 2;
          return (
            <g
              key={laid.id}
              opacity={dim ? 0.45 : 1}
              {...(clickable
                ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-pressed': selected,
                    'aria-label': `${node.label}: ${formatMoney(laid.value)}`,
                    onClick: () => onToggleCategory(node.category ?? node.label),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggleCategory(node.category ?? node.label);
                      }
                    },
                  }
                : {})}
              className={
                clickable ? 'cursor-pointer outline-none focus-visible:opacity-100' : undefined
              }
            >
              {clickable && (
                // Small nodes are hard to hit, so the whole row is the target: the node, its
                // label, and half the gap above and below (which keeps neighbours from overlapping).
                <rect
                  x={laid.x}
                  y={laid.y - NODE_PADDING / 2}
                  width={laid.width + labelRoom}
                  height={laid.height + NODE_PADDING}
                  fill="transparent"
                  onMouseMove={track(`node:${laid.id}`)}
                />
              )}
              <rect
                x={laid.x}
                y={laid.y}
                width={laid.width}
                height={laid.height}
                rx={2}
                fill={colorOfNode(node)}
                stroke={selected ? 'var(--color-fg)' : undefined}
                strokeWidth={selected ? 2 : 0}
                onMouseMove={track(`node:${laid.id}`)}
              />
              <text
                x={laid.x + laid.width + 6}
                y={textY}
                dominantBaseline="central"
                className={`pointer-events-none fill-fg text-xs${selected ? 'font-semibold' : ''}`}
                style={{ paintOrder: 'stroke', stroke: 'var(--color-surface)', strokeWidth: 3 }}
              >
                <tspan
                  x={laid.x + laid.width + 6}
                  dy={lines ? '-0.6em' : 0}
                  className="font-medium"
                >
                  {node.label}
                </tspan>
                {lines ? (
                  <tspan x={laid.x + laid.width + 6} dy="1.2em" className="fill-muted tabular-nums">
                    {formatMoney(laid.value)}
                  </tspan>
                ) : (
                  <tspan dx={6} className="fill-muted tabular-nums">
                    {formatMoney(laid.value)}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="sr-only">
        {flow.links.map((link) => (
          <li key={`${link.source}>${link.target}`}>
            {labelOf(link.source)} to {labelOf(link.target)}: {formatMoney(link.value)}
          </li>
        ))}
      </ul>
    </div>
  );
}

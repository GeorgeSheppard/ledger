import { useMemo, useState } from 'react';
import type { FlowKind, FlowNode, MoneyFlow } from '../../../lib/paychecks/flow';
import { layoutSankey, linkPath } from './layout';
import { formatMoney, formatPercent } from '../shared/format';
import { ChartTooltip } from '../shared/ChartTooltip';
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
  x: number;
  y: number;
}

interface SankeyChartProps {
  flow: MoneyFlow;
  colorOf(category: string): string;
}

/** A Sankey diagram of a `MoneyFlow`: ribbons as wide as the money they carry. */
export function SankeyChart({ flow, colorOf }: SankeyChartProps) {
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
  const labelOf = (id: string) => nodeById.get(id)?.label ?? id;

  const track = (key: string) => (event: React.MouseEvent) => {
    const box = frame.current?.getBoundingClientRect();
    if (box) setHover({ key, x: event.clientX - box.left, y: event.clientY - box.top });
  };
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
    if (hoveredLink) return hoveredLink === link ? 0.65 : 0.15;
    if (hoveredNode)
      return link.source === hoveredNode.id || link.target === hoveredNode.id ? 0.65 : 0.12;
    return MIN_LINK_OPACITY;
  };

  const tooltip = (() => {
    if (!hover) return null;
    if (hoveredLink) {
      const sourceTotal = layout.nodes.find((n) => n.id === hoveredLink.source)?.value ?? 0;
      return {
        title: `${labelOf(hoveredLink.source)} → ${labelOf(hoveredLink.target)}`,
        rows: [
          { label: 'Amount', value: formatMoney(hoveredLink.value), emphasis: true },
          ...(sourceTotal > 0
            ? [
                {
                  label: `Of ${labelOf(hoveredLink.source)}`,
                  value: formatPercent(hoveredLink.value / sourceTotal),
                },
              ]
            : []),
        ],
      };
    }
    if (hoveredNode) {
      const node = nodeById.get(hoveredNode.id)!;
      return {
        title: node.label,
        rows: [{ label: 'Amount', value: formatMoney(hoveredNode.value), emphasis: true }],
      };
    }
    return null;
  })();

  return (
    <div ref={frame} className="relative w-full" onMouseLeave={clear}>
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
          const dim = hoveredNode && !touches(laid.id);
          const lines = laid.height >= 28;
          const textY = laid.y + laid.height / 2;
          return (
            <g key={laid.id} opacity={dim ? 0.45 : 1}>
              <rect
                x={laid.x}
                y={laid.y}
                width={laid.width}
                height={laid.height}
                rx={2}
                fill={colorOfNode(node)}
                onMouseMove={track(`node:${laid.id}`)}
                className="cursor-default"
              />
              <text
                x={laid.x + laid.width + 6}
                y={textY}
                dominantBaseline="central"
                className="pointer-events-none fill-fg text-xs"
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
                ) : null}
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip && hover && (
        <ChartTooltip
          title={tooltip.title}
          rows={tooltip.rows}
          x={hover.x}
          y={hover.y}
          chartWidth={width}
        />
      )}
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

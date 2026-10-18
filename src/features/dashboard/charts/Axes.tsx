import { formatCompact, formatMonthShort } from '../format';
import type { LinearScale } from './scale';
import { CHART_CLASSES } from './theme';

const AXIS_LABEL = CHART_CLASSES.axisLabel;

interface YGridProps {
  y: LinearScale;
  left: number;
  right: number;
}

/** Horizontal hairline grid with compact labels on the left; zero drawn a step stronger. */
export function YGrid({ y, left, right }: YGridProps) {
  return (
    <g>
      {y.ticks.map((tick) => (
        <g key={tick}>
          <line
            className={tick === 0 ? 'stroke-muted/60' : 'stroke-line'}
            shapeRendering="crispEdges"
            x1={left}
            x2={right}
            y1={y(tick)}
            y2={y(tick)}
          />
          <text className={AXIS_LABEL} x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
            {formatCompact(tick)}
          </text>
        </g>
      ))}
    </g>
  );
}

interface MonthAxisProps {
  months: string[];
  x(index: number): number;
  y: number;
  /** Roughly how much horizontal room each label needs. */
  minSpacing?: number;
  width: number;
}

/** Month labels along the bottom, thinned so they never collide. Years show on January. */
export function MonthAxis({ months, x, y, minSpacing = 44, width }: MonthAxisProps) {
  const every = Math.max(1, Math.ceil((months.length * minSpacing) / Math.max(width, 1)));
  return (
    <g>
      {months.map((month, i) =>
        (months.length - 1 - i) % every === 0 ? (
          <text key={month} className={AXIS_LABEL} x={x(i)} y={y} textAnchor="middle">
            {formatMonthShort(month, i === 0 || month.endsWith('-01'))}
          </text>
        ) : null
      )}
    </g>
  );
}

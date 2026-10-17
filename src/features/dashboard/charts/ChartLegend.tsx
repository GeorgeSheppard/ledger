import { cn } from '../../../ui/cn';

type SwatchShape = 'square' | 'dot';

/** Small colour key shown beside a label. */
export function Swatch({ color, shape = 'square' }: { color: string; shape?: SwatchShape }) {
  return (
    <span
      className={cn(
        'inline-block size-2.5 flex-none',
        shape === 'dot' ? 'rounded-full' : 'rounded-sm'
      )}
      style={{ background: color }}
    />
  );
}

export interface LegendItem {
  label: string;
  color: string;
  shape?: SwatchShape;
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <Swatch color={item.color} shape={item.shape} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

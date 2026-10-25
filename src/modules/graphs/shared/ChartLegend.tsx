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
  /** Whether the item is switched on. Only matters when `onToggle` is given. */
  on?: boolean;
  onToggle?(): void;
}

/** The key to a chart. Items with `onToggle` are buttons that switch their series or filter on and off. */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted">
      {items.map((item) => {
        const key = (
          <>
            <Swatch color={item.color} shape={item.shape} />
            <span className={cn(item.on === false && 'line-through')}>{item.label}</span>
          </>
        );
        return (
          <li key={item.label}>
            {item.onToggle ? (
              <button
                type="button"
                aria-pressed={item.on !== false}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  item.on === false && 'opacity-50'
                )}
                onClick={item.onToggle}
              >
                {key}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-1.5 py-0.5">{key}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

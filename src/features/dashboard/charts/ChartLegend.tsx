export interface LegendItem {
  label: string;
  color: string;
  /** `line` for line series, `dot` for markers, `square` (default) for fills. */
  shape?: 'square' | 'line' | 'dot';
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.label} className="chart-legend__item">
          <span
            className={`chart-swatch chart-swatch--${item.shape ?? 'square'}`}
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

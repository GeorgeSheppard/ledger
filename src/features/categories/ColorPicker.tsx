import { CATEGORY_PALETTE } from '../../lib/categories/palette';
import './ColorPicker.css';

interface ColorPickerProps {
  value: string;
  onChange(color: string): void;
}

/** Palette swatches plus a custom colour well. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const custom = !CATEGORY_PALETTE.some((c) => c === value.toLowerCase());
  return (
    <div className="color-picker" role="radiogroup" aria-label="Colour">
      {CATEGORY_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value.toLowerCase()}
          aria-label={color}
          className="color-picker__swatch"
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
      <label
        className={['color-picker__custom', custom && 'color-picker__custom--active']
          .filter(Boolean)
          .join(' ')}
        title="Custom colour"
        style={custom ? { background: value } : undefined}
      >
        <input
          type="color"
          aria-label="Custom colour"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

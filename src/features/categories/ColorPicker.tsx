import { CATEGORY_PALETTE } from '../../lib/categories/palette';
import { cn } from '../../ui/cn';

interface ColorPickerProps {
  value: string;
  onChange(color: string): void;
}

const SWATCH =
  'relative size-5.5 cursor-pointer rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent';
const CHECKED = 'ring-2 ring-fg ring-offset-2 ring-offset-surface';

/** Palette swatches plus a custom colour well. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const custom = !CATEGORY_PALETTE.some((c) => c === value.toLowerCase());
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Colour">
      {CATEGORY_PALETTE.map((color) => {
        const checked = color === value.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={color}
            className={cn(SWATCH, checked && CHECKED)}
            style={{ background: color }}
            onClick={() => onChange(color)}
          />
        );
      })}
      <label
        className={cn(
          SWATCH,
          'focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-accent',
          custom && CHECKED
        )}
        title="Custom colour"
        // A rainbow until a custom colour is picked; data-driven colours are inline styles.
        style={{
          background: custom ? value : 'conic-gradient(#f66, #fd6, #6d6, #6df, #66f, #f6f, #f66)',
        }}
      >
        <input
          type="color"
          aria-label="Custom colour"
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

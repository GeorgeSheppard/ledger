import { useState } from 'react';
import type { Category } from '../../lib/domain/types';
import { amountToInput, parseAmount } from '../../lib/transactions/amount';
import {
  hasFilters,
  noFilters,
  type AmountSign,
  type Sort,
  type SortKey,
  type TransactionFilters,
} from '../../lib/transactions/filters';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { Select } from '../../ui/Select';
import { TextInput } from '../../ui/TextInput';
import { CategoryChip } from '../categories/CategoryChip';

interface TransactionFilterPanelProps {
  filters: TransactionFilters;
  onChange(filters: TransactionFilters): void;
  /** Category names used by this account's transactions (`''` is "no category"). */
  categoryNames: readonly string[];
  categories: Category[];
  sort: Sort;
  onSortChange(sort: Sort): void;
}

const SIGNS: { value: AmountSign; label: string }[] = [
  { value: 'any', label: 'All' },
  { value: 'in', label: 'Money in' },
  { value: 'out', label: 'Money out' },
];

const SORT_KEYS: { value: SortKey; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'category', label: 'Category' },
  { value: 'note', label: 'Note' },
  { value: 'amount', label: 'Amount' },
  { value: 'total', label: 'Total' },
];

/** Date range, categories, amount and duplicate filters, plus a sort picker (for small screens). */
export function TransactionFilterPanel({
  filters,
  onChange,
  categoryNames,
  categories,
  sort,
  onSortChange,
}: TransactionFilterPanelProps) {
  const set = (patch: Partial<TransactionFilters>) => onChange({ ...filters, ...patch });
  const toggleCategory = (name: string) =>
    set({
      categories: filters.categories.includes(name)
        ? filters.categories.filter((c) => c !== name)
        : [...filters.categories, name],
    });

  return (
    <Card className="mb-4 grid gap-5 p-4 md:grid-cols-2" aria-label="Filters" role="group">
      <Section title="Date">
        <div className="flex items-center gap-2">
          <TextInput
            type="date"
            aria-label="From date"
            value={filters.from ?? ''}
            max={filters.to ?? undefined}
            onChange={(e) => set({ from: e.target.value || null })}
          />
          <span className="text-sm text-muted">to</span>
          <TextInput
            type="date"
            aria-label="To date"
            value={filters.to ?? ''}
            min={filters.from ?? undefined}
            onChange={(e) => set({ to: e.target.value || null })}
          />
        </div>
      </Section>

      <Section title="Amount">
        <div className="flex flex-col gap-2">
          <div
            className="inline-flex self-start overflow-hidden rounded-lg border border-line"
            role="group"
            aria-label="Money in or out"
          >
            {SIGNS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filters.sign === option.value}
                className={cn(
                  'cursor-pointer px-3 py-1 text-sm transition-colors hover:bg-surface-hover',
                  filters.sign === option.value && 'bg-accent/12 font-medium text-accent'
                )}
                onClick={() => set({ sign: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <AmountField
              label="Smallest amount"
              placeholder="From"
              value={filters.min}
              disabled={filters.exact !== null}
              onChange={(min) => set({ min })}
            />
            <span className="text-sm text-muted">to</span>
            <AmountField
              label="Largest amount"
              placeholder="To"
              value={filters.max}
              disabled={filters.exact !== null}
              onChange={(max) => set({ max })}
            />
            <span className="text-sm text-muted">or exactly</span>
            <AmountField
              label="Exact amount"
              placeholder="12.50"
              value={filters.exact}
              onChange={(exact) => set({ exact })}
            />
          </div>
          <p className="text-xs text-muted">Sizes ignore the sign, so 20 matches +20 and -20.</p>
        </div>
      </Section>

      <Section title="Category" className="md:col-span-2">
        <div className="flex flex-wrap gap-1.5">
          {categoryNames.map((name) => (
            <button
              key={name || 'none'}
              type="button"
              aria-pressed={filters.categories.includes(name)}
              className={cn(
                'cursor-pointer rounded-full border border-transparent transition-colors hover:border-line',
                filters.categories.includes(name) && 'border-accent ring-2 ring-accent/20'
              )}
              onClick={() => toggleCategory(name)}
            >
              <CategoryChip name={name} categories={categories} />
            </button>
          ))}
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 md:col-span-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={filters.duplicatesOnly}
            onChange={(e) => set({ duplicatesOnly: e.target.checked, twinsOf: null })}
          />
          Only possible duplicates
        </label>
        <label className="inline-flex items-center gap-2 text-sm md:hidden">
          Sort by
          <Select
            value={sort.key}
            onChange={(e) => onSortChange({ ...sort, key: e.target.value as SortKey })}
          >
            {SORT_KEYS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Sort direction"
            value={sort.direction}
            onChange={(e) =>
              onSortChange({ ...sort, direction: e.target.value as Sort['direction'] })
            }
          >
            <option value="desc">High to low / newest</option>
            <option value="asc">Low to high / oldest</option>
          </Select>
        </label>
        <ActionButton
          className="ml-auto"
          variant="ghost"
          disabled={!hasFilters(filters)}
          onAction={() => onChange(noFilters)}
        >
          Clear filters
        </ActionButton>
      </div>
    </Card>
  );
}

function Section({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-2', className)}>
      <legend className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/** A number box that keeps what is typed (like "12.") until it parses, then reports the number. */
function AmountField({
  label,
  placeholder,
  value,
  disabled,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: number | null;
  disabled?: boolean;
  onChange(value: number | null): void;
}) {
  const [text, setText] = useState(value === null ? '' : amountToInput(value));
  const [lastValue, setLastValue] = useState(value);
  // Follow changes made elsewhere (Clear filters, a row menu action) but not our own typing.
  if (value !== lastValue) {
    setLastValue(value);
    if (parseAmount(text) !== value) setText(value === null ? '' : amountToInput(value));
  }
  return (
    <TextInput
      className="text-right tabular-nums"
      aria-label={label}
      placeholder={placeholder}
      inputMode="decimal"
      disabled={disabled}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        if (next.trim() === '') {
          setLastValue(null);
          onChange(null);
          return;
        }
        const parsed = parseAmount(next);
        if (parsed !== null) {
          const size = Math.abs(parsed);
          setLastValue(size);
          onChange(size);
        }
      }}
    />
  );
}

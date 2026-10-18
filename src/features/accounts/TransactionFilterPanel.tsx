import { useState, type Ref } from 'react';
import type { Account, Category } from '../../lib/domain/types';
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
  /** Set when the list mixes accounts, so they can be filtered too. */
  accounts?: Account[];
  sort: Sort;
  onSortChange(sort: Sort): void;
  /** Lets the table focus the notes search from its shortcut. */
  searchRef?: Ref<HTMLInputElement>;
  /** Focus the notes search as the panel opens (from the search shortcut). */
  autoFocusSearch?: boolean;
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

type Change = (patch: Partial<TransactionFilters>) => void;

interface FilterFieldProps {
  filters: TransactionFilters;
  set: Change;
}

/** The note search and the duplicates switch. */
export function NoteFilter({
  filters,
  set,
  searchRef,
  autoFocus,
}: FilterFieldProps & { searchRef?: Ref<HTMLInputElement>; autoFocus?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <TextInput
        ref={searchRef}
        type="search"
        className="w-full min-w-56"
        aria-label="Search transactions"
        placeholder="Search notes…"
        autoFocus={autoFocus}
        value={filters.search}
        onChange={(e) => set({ search: e.target.value })}
        onKeyDown={(e) => {
          if (e.key !== 'Escape' || !filters.search) return;
          e.nativeEvent.stopPropagation();
          e.stopPropagation();
          set({ search: '' });
        }}
      />
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-accent"
          checked={filters.duplicatesOnly}
          onChange={(e) => set({ duplicatesOnly: e.target.checked, twinsOf: null })}
        />
        Only possible duplicates
      </label>
    </div>
  );
}

export function DateFilter({ filters, set }: FilterFieldProps) {
  return (
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
  );
}

export function AmountFilter({ filters, set }: FilterFieldProps) {
  return (
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
  );
}

export function CategoryFilter({
  filters,
  set,
  categoryNames,
  categories,
}: FilterFieldProps & { categoryNames: readonly string[]; categories: Category[] }) {
  const toggle = (name: string) =>
    set({
      categories: filters.categories.includes(name)
        ? filters.categories.filter((c) => c !== name)
        : [...filters.categories, name],
    });
  return (
    <div className="flex max-w-96 flex-wrap gap-1.5">
      {categoryNames.map((name) => (
        <button
          key={name || 'none'}
          type="button"
          aria-pressed={filters.categories.includes(name)}
          className={cn(
            'cursor-pointer rounded-full border border-transparent transition-colors hover:border-line',
            filters.categories.includes(name) && 'border-accent ring-2 ring-accent/20'
          )}
          onClick={() => toggle(name)}
        >
          <CategoryChip name={name} categories={categories} />
        </button>
      ))}
    </div>
  );
}

export function AccountFilter({
  filters,
  set,
  accounts,
}: FilterFieldProps & { accounts: readonly Account[] }) {
  const toggle = (id: number) =>
    set({
      accounts: filters.accounts.includes(id)
        ? filters.accounts.filter((a) => a !== id)
        : [...filters.accounts, id],
    });
  return (
    <div className="flex max-w-96 flex-wrap gap-1.5">
      {accounts.map((account) => (
        <button
          key={account.id}
          type="button"
          aria-pressed={filters.accounts.includes(account.id)}
          className={cn(
            'cursor-pointer rounded-full border border-line px-2.5 py-0.5 text-sm transition-colors hover:bg-surface-hover',
            filters.accounts.includes(account.id) &&
              'border-accent bg-accent/10 ring-2 ring-accent/20'
          )}
          onClick={() => toggle(account.id)}
        >
          {account.name}
        </button>
      ))}
    </div>
  );
}

/**
 * Every filter in one card, for small screens where there are no column headers to hang them on.
 * Wide screens use the same pieces in popovers on the headers.
 */
export function TransactionFilterPanel({
  filters,
  onChange,
  categoryNames,
  categories,
  accounts,
  sort,
  onSortChange,
  searchRef,
  autoFocusSearch,
}: TransactionFilterPanelProps) {
  const set: Change = (patch) => onChange({ ...filters, ...patch });

  return (
    <Card className="mb-4 grid gap-5 p-4" aria-label="Filters" role="group">
      <Section title="Notes">
        <NoteFilter filters={filters} set={set} searchRef={searchRef} autoFocus={autoFocusSearch} />
      </Section>
      <Section title="Date">
        <DateFilter filters={filters} set={set} />
      </Section>
      <Section title="Amount">
        <AmountFilter filters={filters} set={set} />
      </Section>
      <Section title="Category">
        <CategoryFilter
          filters={filters}
          set={set}
          categoryNames={categoryNames}
          categories={categories}
        />
      </Section>
      {accounts && (
        <Section title="Account">
          <AccountFilter filters={filters} set={set} accounts={accounts} />
        </Section>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="inline-flex items-center gap-2 text-sm">
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
          Reset filters
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

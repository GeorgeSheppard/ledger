import { useId, useMemo, useState, type KeyboardEvent, type Ref } from 'react';
import {
  categoryColor,
  findCategory,
  searchCategories,
  validateCategoryName,
} from '../../lib/categories/categories';
import type { Category } from '../../lib/domain/types';
import { cn } from '../../ui/cn';
import { TextInput } from '../../ui/TextInput';

const OPTION = 'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm';

type Option =
  { kind: 'none' } | { kind: 'category'; category: Category } | { kind: 'create'; name: string };

interface CategoryPickerProps {
  value: string;
  /** The categories offered in the list. */
  categories: Category[];
  /**
   * Every category, used for the chip colour and to refuse a new name that already exists, even if
   * it is limited to another account. Defaults to `categories`.
   */
  allCategories?: Category[];
  onChange(name: string): void;
  /** Adds a new category to the list. The picker selects it once this resolves. */
  onCreate(name: string): Promise<void>;
  inputRef?: Ref<HTMLInputElement>;
  invalid?: boolean;
  'aria-label'?: string;
}

/**
 * Combobox for choosing a category: type to filter, arrows to move, Enter to pick. When the typed
 * name does not exist yet, the last option creates it. Escape closes the list before it lets the
 * key reach the row editor (which cancels editing).
 */
export function CategoryPicker({
  value,
  categories,
  allCategories = categories,
  onChange,
  onCreate,
  inputRef,
  invalid,
  'aria-label': ariaLabel = 'Category',
}: CategoryPickerProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);

  const options = useMemo<Option[]>(() => {
    const matches = searchCategories(categories, open ? query : '');
    const list: Option[] = matches.map((category) => ({ kind: 'category', category }));
    if (!query.trim() || !open) list.unshift({ kind: 'none' });
    if (open && query.trim() && validateCategoryName(allCategories, query) === null)
      list.push({ kind: 'create', name: query.trim() });
    return list;
  }, [categories, allCategories, query, open]);

  const openList = () => {
    setOpen(true);
    setActive(0);
  };

  const close = () => {
    setOpen(false);
    setQuery(value);
  };

  const pick = async (option: Option | undefined) => {
    if (!option) return;
    if (option.kind === 'none') commit('');
    else if (option.kind === 'category') commit(option.category.name);
    else {
      setCreating(true);
      try {
        await onCreate(option.name);
        commit(option.name);
      } finally {
        setCreating(false);
      }
    }
  };

  const commit = (name: string) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return openList();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + delta + options.length) % options.length);
    } else if (event.key === 'Enter' && open && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      void pick(options[active]);
    } else if (event.key === 'Escape' && open) {
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab' && open) {
      // Accept an exact match on tab so typing "rent⇥" works; otherwise keep the old value.
      const exact = findCategory(allCategories, query);
      if (exact) commit(exact.name);
      else if (!query.trim()) commit('');
      else close();
    }
  };

  const shownColor = value.trim() && !open ? categoryColor(allCategories, value) : undefined;

  return (
    <div className="relative min-w-0">
      {shownColor && (
        <span
          className="pointer-events-none absolute top-1/2 left-2.5 size-2 -translate-y-1/2 rounded-full"
          style={{ background: shownColor }}
          aria-hidden="true"
        />
      )}
      <TextInput
        ref={inputRef}
        className={cn(shownColor && 'pl-6')}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        placeholder="Uncategorised"
        value={open ? query : value}
        readOnly={creating}
        onFocus={(event) => {
          setQuery(value);
          openList();
          event.currentTarget.select();
        }}
        onBlur={close}
        onChange={(event) => {
          const text = event.target.value;
          setQuery(text);
          setOpen(true);
          setActive(0);
          // Keep the value in step with an exact match so saving without picking still works.
          const exact = findCategory(allCategories, text);
          if (exact) onChange(exact.name);
          else if (!text.trim()) onChange('');
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full left-0 z-20 mt-1 max-h-64 w-max max-w-72 min-w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg"
        >
          {options.map((option, i) => (
            <li
              key={option.kind === 'category' ? option.category.name : option.kind}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn(
                OPTION,
                i === active && 'bg-surface-hover',
                option.kind === 'create' && 'text-accent'
              )}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => void pick(option)}
            >
              {option.kind === 'none' && <span className="text-muted">No category</span>}
              {option.kind === 'category' && (
                <>
                  <span
                    className="size-2.5 flex-none rounded-full"
                    style={{ background: option.category.color }}
                    aria-hidden="true"
                  />
                  {option.category.name}
                </>
              )}
              {option.kind === 'create' && (
                <>
                  <span className="w-2.5 text-center font-semibold" aria-hidden="true">
                    +
                  </span>
                  Add “{option.name}”
                </>
              )}
            </li>
          ))}
          {options.length === 0 && (
            <li className={cn(OPTION, 'cursor-default text-muted')}>No matches</li>
          )}
        </ul>
      )}
    </div>
  );
}

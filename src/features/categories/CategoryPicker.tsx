import { useId, useMemo, useState, type KeyboardEvent, type Ref } from 'react';
import {
  categoryColor,
  findCategory,
  searchCategories,
  validateCategoryName,
} from '../../lib/categories/categories';
import type { Category } from '../../lib/domain/types';
import '../accounts/inlineField.css';
import './CategoryPicker.css';

type Option =
  { kind: 'none' } | { kind: 'category'; category: Category } | { kind: 'create'; name: string };

interface CategoryPickerProps {
  value: string;
  categories: Category[];
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
    if (open && query.trim() && validateCategoryName(categories, query) === null)
      list.push({ kind: 'create', name: query.trim() });
    return list;
  }, [categories, query, open]);

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
      const exact = findCategory(categories, query);
      if (exact) commit(exact.name);
      else if (!query.trim()) commit('');
      else close();
    }
  };

  const shownColor = value.trim() && !open ? categoryColor(categories, value) : undefined;

  return (
    <div className="category-picker">
      {shownColor && (
        <span
          className="category-picker__dot"
          style={{ background: shownColor }}
          aria-hidden="true"
        />
      )}
      <input
        ref={inputRef}
        className={[
          'inline-field',
          'category-picker__input',
          shownColor && 'category-picker__input--with-dot',
        ]
          .filter(Boolean)
          .join(' ')}
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
          const exact = findCategory(categories, text);
          if (exact) onChange(exact.name);
          else if (!text.trim()) onChange('');
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id={listId} role="listbox" className="category-picker__list">
          {options.map((option, i) => (
            <li
              key={option.kind === 'category' ? option.category.name : option.kind}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={[
                'category-picker__option',
                i === active && 'category-picker__option--active',
                option.kind === 'create' && 'category-picker__option--create',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => void pick(option)}
            >
              {option.kind === 'none' && (
                <span className="category-picker__muted">No category</span>
              )}
              {option.kind === 'category' && (
                <>
                  <span
                    className="category-picker__swatch"
                    style={{ background: option.category.color }}
                    aria-hidden="true"
                  />
                  {option.category.name}
                </>
              )}
              {option.kind === 'create' && (
                <>
                  <span className="category-picker__plus" aria-hidden="true">
                    +
                  </span>
                  Add “{option.name}”
                </>
              )}
            </li>
          ))}
          {options.length === 0 && (
            <li className="category-picker__option category-picker__muted">No matches</li>
          )}
        </ul>
      )}
    </div>
  );
}

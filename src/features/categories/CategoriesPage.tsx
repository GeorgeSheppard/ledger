import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { usageOf } from '../../lib/categories/categories';
import { nextCategoryColor } from '../../lib/categories/palette';
import { CATEGORIES_TAB, type Category } from '../../lib/domain/types';
import {
  initialRowEditorState,
  isEditing,
  neighbourAfterRemoval,
  rowEditorReducer,
} from '../../lib/transactions/rowEditor';
import { useShortcut } from '../../state/shortcuts';
import { ActionButton } from '../../ui/ActionButton';
import { Kbd } from '../../ui/Kbd';
import { DeleteConfirm } from '../accounts/DeleteConfirm';
import { CategoryEditor } from './CategoryEditor';
import { CategoryRow } from './CategoryRow';
import { useCategoriesWithUsage, useCategoryActions } from './useCategoriesData';
import './CategoriesPage.css';

/** `/categories`: add, rename, recolour, reorder and delete categories. */
export function CategoriesPage() {
  const query = useCategoriesWithUsage();
  return (
    <div className="categories-page">
      <header className="categories-page__header">
        <h1>Categories</h1>
        <p>
          Stored in the <code>{CATEGORIES_TAB}</code> tab of your sheet. Renaming a category updates
          every transaction that uses it.
        </p>
      </header>
      {query.status === 'loading' && <p className="categories-page__message">Loading…</p>}
      {query.status === 'error' && (
        <p className="categories-page__message">Could not load categories: {query.error.message}</p>
      )}
      {query.status === 'ready' && (
        <CategoryList categories={query.data.categories} usage={query.data.usage} />
      )}
    </div>
  );
}

function CategoryList({
  categories,
  usage,
}: {
  categories: Category[];
  usage: Map<string, number>;
}) {
  const actions = useCategoryActions();
  const [state, dispatch] = useReducer(rowEditorReducer, initialRowEditorState);
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const ids = useMemo(() => categories.map((c) => c.name), [categories]);
  const selected = categories.find((c) => c.name === state.selectedId);
  const mode = state.mode;
  const browsing = mode.kind === 'browse';

  useEffect(() => {
    if (!state.selectedId) return;
    listRef.current
      ?.querySelector(`[data-row-id="${CSS.escape(state.selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [state.selectedId, mode.kind]);

  const run = async (write: () => Promise<unknown>, selectId?: string | null) => {
    setSaving(true);
    setWriteError(null);
    try {
      await write();
      dispatch({ type: 'done', selectId });
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const open = (category: Category) => {
    if (saving || isEditing(state)) return;
    dispatch({ type: 'cancel' });
    dispatch({ type: 'edit', id: category.name });
  };

  const save = (next: Category) => {
    if (mode.kind === 'new') void run(() => actions.add(next.name, next.color), next.name);
    else if (mode.kind === 'edit' && selected)
      void run(() => actions.edit(selected, next), next.name);
  };

  const move = (delta: number) => {
    if (!selected || saving) return;
    void run(() => actions.move(selected.name, delta), selected.name);
  };

  const remove = () => {
    if (mode.kind !== 'confirm-delete' || !selected) return;
    const next = neighbourAfterRemoval(ids, selected.name);
    void run(() => actions.remove(selected.name), next);
  };

  const cancel = () => {
    dispatch({ type: 'cancel' });
    setWriteError(null);
  };

  useShortcut('categories.down', () => dispatch({ type: 'move', delta: 1, ids }), browsing);
  useShortcut('categories.up', () => dispatch({ type: 'move', delta: -1, ids }), browsing);
  useShortcut('categories.moveDown', () => move(1), browsing && !!selected);
  useShortcut('categories.moveUp', () => move(-1), browsing && !!selected);
  useShortcut('categories.cancel', cancel, browsing && !!selected);

  const editorFor = (original?: Category) => (
    <CategoryEditor
      key={original?.name ?? 'new'}
      categories={categories}
      original={original}
      initialColor={nextCategoryColor(categories)}
      usage={original ? usageOf(usage, original.name) : 0}
      saving={saving}
      onSave={save}
      onCancel={cancel}
    />
  );

  const selectedUsage = selected ? usageOf(usage, selected.name) : 0;

  return (
    <section className="category-list" aria-label="Categories">
      <div className="category-list__toolbar">
        <ActionButton
          shortcut="categories.new"
          variant="primary"
          disabled={!browsing || saving}
          onAction={() => dispatch({ type: 'new' })}
        >
          New category
        </ActionButton>
        <ActionButton
          shortcut="categories.edit"
          disabled={!selected || !browsing || saving}
          onAction={() => dispatch({ type: 'edit' })}
        >
          Edit
        </ActionButton>
        <ActionButton
          shortcut="categories.delete"
          variant="danger"
          disabled={!selected || !browsing || saving}
          onAction={() => dispatch({ type: 'confirm-delete' })}
        >
          Delete
        </ActionButton>
        <span className="category-list__hint">
          <Kbd shortcut="categories.down" />
          <Kbd shortcut="categories.up" />
          move
          <Kbd shortcut="categories.moveDown" />
          <Kbd shortcut="categories.moveUp" />
          reorder
        </span>
      </div>

      {writeError && (
        <p className="category-list__error" role="alert">
          Could not save: {writeError}
        </p>
      )}

      <div className="category-list__body" role="table" ref={listRef}>
        {mode.kind === 'new' && editorFor()}
        {categories.length === 0 && mode.kind !== 'new' && (
          <div className="category-list__empty">
            No categories yet. Press <Kbd shortcut="categories.new" /> to add one.
          </div>
        )}
        {categories.map((category) => {
          if (mode.kind === 'edit' && mode.id === category.name)
            return (
              <div key={category.name} data-row-id={category.name}>
                {editorFor(category)}
              </div>
            );
          const row = (
            <CategoryRow
              key={category.name}
              category={category}
              usage={usageOf(usage, category.name)}
              selected={category.name === state.selectedId}
              onOpen={open}
            />
          );
          if (mode.kind === 'confirm-delete' && mode.id === category.name)
            return (
              <div key={category.name}>
                {row}
                <DeleteConfirm
                  message={
                    selectedUsage > 0
                      ? `Delete “${category.name}”? ${selectedUsage} ${selectedUsage === 1 ? 'transaction keeps' : 'transactions keep'} the name, shown as an unlisted category.`
                      : `Delete “${category.name}”?`
                  }
                  deleteShortcut="categories.delete"
                  cancelShortcut="categories.cancel"
                  busy={saving}
                  onConfirm={remove}
                  onCancel={cancel}
                />
              </div>
            );
          return row;
        })}
      </div>
    </section>
  );
}

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { activeCategories, isArchived, usageOf } from '../../lib/categories/categories';
import { nextCategoryColor } from '../../lib/categories/palette';
import { METADATA_TAB, type Account, type Category } from '../../lib/domain/types';
import {
  initialRowEditorState,
  isEditing,
  neighbourAfterRemoval,
  rowEditorReducer,
} from '../../lib/transactions/rowEditor';
import { useLedger } from '../../state/ledgerData';
import { useShortcut } from '../../state/shortcuts';
import { ActionButton } from '../../ui/ActionButton';
import { Kbd } from '../../ui/Kbd';
import { DeleteConfirm } from '../accounts/DeleteConfirm';
import { CategoryEditor } from './CategoryEditor';
import { CategoryRow } from './CategoryRow';
import { MigrateConfirm } from './MigrateConfirm';
import { useCategoriesWithUsage, useCategoryActions } from './useCategoriesData';
import { Page } from '../../ui/Page';

/** `/categories`: add, rename, recolour, reorder and delete categories. */
export function CategoriesPage() {
  const query = useCategoriesWithUsage();
  const { accounts } = useLedger();
  return (
    <Page
      title="Categories"
      className="max-w-3xl"
      description={
        <>
          Stored in the <code className="font-mono">{METADATA_TAB}</code> tab of your sheet.
          Renaming a category updates every transaction that uses it. Archive a category you no
          longer use to hide it from lists and pickers; its transactions and history stay as they
          are.
        </>
      }
    >
      {query.status === 'loading' && <p className="text-sm text-muted">Loading…</p>}
      {query.status === 'error' && (
        <p className="text-sm text-muted">Could not load categories: {query.error.message}</p>
      )}
      {query.status === 'ready' && (
        <CategoryList
          categories={query.data.categories}
          accounts={accounts}
          usage={query.data.usage}
        />
      )}
    </Page>
  );
}

function CategoryList({
  categories: allCategories,
  accounts,
  usage,
}: {
  categories: Category[];
  accounts: Account[];
  usage: Map<string, number>;
}) {
  const actions = useCategoryActions();
  const [state, dispatch] = useReducer(rowEditorReducer, initialRowEditorState);
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [migrating, setMigrating] = useState<string | null>(null);
  const categories = useMemo(() => activeCategories(allCategories), [allCategories]);
  const archived = useMemo(() => allCategories.filter(isArchived), [allCategories]);

  const ids = useMemo(() => categories.map((c) => c.name), [categories]);
  const selected = categories.find((c) => c.name === state.selectedId);
  const mode = state.mode;
  const browsing = mode.kind === 'browse' && migrating === null;

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
    if (mode.kind === 'new')
      void run(() => actions.add(next.name, next.color, next.excluded, next.accounts), next.name);
    else if (mode.kind === 'edit' && selected)
      void run(() => actions.edit(selected, next), next.name);
  };

  const remove = () => {
    if (mode.kind !== 'confirm-delete' || !selected) return;
    const next = neighbourAfterRemoval(ids, selected.name);
    void run(() => actions.remove(selected.name), next);
  };

  const archive = () => {
    if (!selected || saving) return;
    void run(() => actions.archive(selected.name), neighbourAfterRemoval(ids, selected.name));
  };

  const migrate = (to: string, archiveAfter: boolean) => {
    if (!migrating) return;
    const from = migrating;
    void run(
      async () => {
        await actions.migrate(from, to, archiveAfter);
        setMigrating(null);
      },
      archiveAfter ? neighbourAfterRemoval(ids, from) : from
    );
  };

  const startMigrate = () => {
    if (!selected) return;
    dispatch({ type: 'cancel' });
    setMigrating(selected.name);
  };

  const startDelete = () => {
    if (!selected) return;
    dispatch({ type: 'cancel' });
    dispatch({ type: 'confirm-delete', id: selected.name });
  };

  const cancel = () => {
    setMigrating(null);
    dispatch({ type: 'cancel' });
    setWriteError(null);
  };

  useShortcut('categories.cancel', cancel, (browsing && !!selected) || migrating !== null);

  const editorFor = (original?: Category) => (
    <CategoryEditor
      key={original?.name ?? 'new'}
      categories={categories}
      accounts={accounts}
      original={original}
      initialColor={nextCategoryColor(categories)}
      usage={original ? usageOf(usage, original.name) : 0}
      saving={saving}
      onSave={save}
      onCancel={cancel}
      onArchive={original ? archive : undefined}
      onMigrate={original ? startMigrate : undefined}
      onDelete={original ? startDelete : undefined}
    />
  );

  const selectedUsage = selected ? usageOf(usage, selected.name) : 0;

  return (
    <section className="flex flex-col" aria-label="Categories">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ActionButton
          shortcut="categories.new"
          variant="primary"
          disabled={!browsing || saving}
          onAction={() => dispatch({ type: 'new' })}
        >
          New category
        </ActionButton>
      </div>

      {writeError && (
        <p className="mb-3 rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative" role="alert">
          Could not save: {writeError}
        </p>
      )}

      <div className="flex flex-col" role="table" ref={listRef}>
        {mode.kind === 'new' && editorFor()}
        {categories.length === 0 && mode.kind !== 'new' && (
          <div className="flex items-center justify-center gap-1.5 p-8 text-muted">
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
          if (migrating === category.name)
            return (
              <div key={category.name}>
                {row}
                <MigrateConfirm
                  from={category}
                  targets={categories.filter((c) => c.name !== category.name)}
                  allCategories={allCategories}
                  count={usageOf(usage, category.name)}
                  busy={saving}
                  onConfirm={migrate}
                  onCancel={cancel}
                  onCreate={(name) => actions.add(name, nextCategoryColor(allCategories))}
                />
              </div>
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

      {archived.length > 0 && (
        <details className="mt-6" open={categories.length === 0 || undefined}>
          <summary className="cursor-pointer text-sm font-medium text-muted">
            Archived ({archived.length})
          </summary>
          <p className="mt-1 mb-2 text-[0.8125rem] text-muted">
            Hidden from pickers and lists. Their transactions keep the category and still appear in
            your graphs.
          </p>
          <div className="flex flex-col" role="table" aria-label="Archived categories">
            {archived.map((category) => (
              <div
                key={category.name}
                role="row"
                className="grid grid-cols-[14px_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2"
              >
                <span
                  role="cell"
                  className="size-3.5 rounded-full opacity-60"
                  style={{ background: category.color }}
                />
                <span role="cell" className="truncate text-muted">
                  {category.name}
                </span>
                <span role="cell" className="text-[0.8125rem] text-muted tabular-nums">
                  {usageOf(usage, category.name) === 0
                    ? 'Unused'
                    : `${usageOf(usage, category.name)} transactions`}
                </span>
                <ActionButton
                  variant="ghost"
                  disabled={saving}
                  onAction={() => void run(() => actions.restore(category.name), category.name)}
                >
                  Restore
                </ActionButton>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

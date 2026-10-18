import { useState } from 'react';
import { validateCategoryName } from '../../lib/categories/categories';
import type { Category } from '../../lib/domain/types';
import { ActionButton } from '../../ui/ActionButton';
import { ColorPicker } from './ColorPicker';
import { cn } from '../../ui/cn';
import { TextInput } from '../../ui/TextInput';
import { EDITOR_FOOTER, EDITOR_PANEL } from '../accounts/rowStyles';

interface CategoryEditorProps {
  categories: Category[];
  /** The category being edited; omit for a new one. */
  original?: Category;
  initialColor: string;
  usage: number;
  saving: boolean;
  onSave(category: Category): void;
  onCancel(): void;
}

/** Inline editor for a category's name and colour. Enter or ⌘↵ saves, Escape cancels. */
export function CategoryEditor({
  categories,
  original,
  initialColor,
  usage,
  saving,
  onSave,
  onCancel,
}: CategoryEditorProps) {
  const [name, setName] = useState(original?.name ?? '');
  const [color, setColor] = useState(original?.color ?? initialColor);
  const [excluded, setExcluded] = useState(original?.excluded ?? false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const problem = validateCategoryName(categories, name, original?.name);
    if (problem) return setError(problem);
    onSave(excluded ? { name: name.trim(), color, excluded } : { name: name.trim(), color });
  };

  const renaming = original && name.trim() && name.trim() !== original.name && usage > 0;

  return (
    <form
      className={EDITOR_PANEL}
      aria-label={original ? `Edit ${original.name}` : 'New category'}
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="flex flex-wrap items-center gap-3 p-3">
        <span
          className="size-3.5 flex-none rounded-full"
          style={{ background: color }}
          aria-hidden="true"
        />
        <TextInput
          className="max-w-80 flex-[1_1_200px]"
          aria-label="Category name"
          aria-invalid={!!error || undefined}
          placeholder="Category name"
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <label className="flex cursor-pointer items-start gap-2 px-3 pb-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-accent"
          checked={excluded}
          onChange={(e) => setExcluded(e.target.checked)}
        />
        <span>
          <span className="font-medium">Exclude from calculations</span>
          <span className="block text-xs text-muted">
            Left out of spending, income, cash flow and the money-flow chart. Balances and net worth
            still include it. Useful for moving money between your own accounts.
          </span>
        </span>
      </label>
      <div className={EDITOR_FOOTER}>
        <p
          className={cn('text-[0.8125rem] text-muted', error && 'text-negative')}
          role={error ? 'alert' : undefined}
        >
          {error ??
            (renaming
              ? `Renaming updates ${usage} ${usage === 1 ? 'transaction' : 'transactions'} in your sheet.`
              : 'Colours are used in charts and category chips.')}
        </p>
        <div className="flex gap-2">
          <ActionButton shortcut="categories.cancel" variant="ghost" onAction={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton
            type="submit"
            shortcut="categories.save"
            variant="primary"
            disabled={saving}
            onAction={save}
          >
            {saving ? 'Saving…' : original ? 'Save' : 'Add'}
          </ActionButton>
        </div>
      </div>
    </form>
  );
}

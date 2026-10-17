import { useState } from 'react';
import { validateCategoryName } from '../../lib/categories/categories';
import type { Category } from '../../lib/domain/types';
import { ActionButton } from '../../ui/ActionButton';
import { ColorPicker } from './ColorPicker';
import '../accounts/inlineField.css';
import './CategoryEditor.css';

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
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const problem = validateCategoryName(categories, name, original?.name);
    if (problem) return setError(problem);
    onSave({ name: name.trim(), color });
  };

  const renaming = original && name.trim() && name.trim() !== original.name && usage > 0;

  return (
    <form
      className="category-editor"
      aria-label={original ? `Edit ${original.name}` : 'New category'}
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="category-editor__fields">
        <span
          className="category-editor__preview"
          style={{ background: color }}
          aria-hidden="true"
        />
        <input
          className="inline-field category-editor__name"
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
      <div className="category-editor__footer">
        <p className="category-editor__message" role={error ? 'alert' : undefined}>
          {error ??
            (renaming
              ? `Renaming updates ${usage} ${usage === 1 ? 'transaction' : 'transactions'} in your sheet.`
              : 'Colours are used in charts and category chips.')}
        </p>
        <div className="category-editor__actions">
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

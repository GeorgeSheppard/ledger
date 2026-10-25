import { useMemo, useState } from 'react';
import { findCategory } from '../../lib/categories/categories';
import type { Category } from '../../lib/domain/types';
import { ActionButton } from '../../ui/ActionButton';
import { CategoryPicker } from './CategoryPicker';

interface MigrateConfirmProps {
  from: Category;
  /** Categories on offer as the target: every active one except `from`. */
  targets: Category[];
  /** Every category, so an archived name is not offered as "new". */
  allCategories: Category[];
  /** Transactions (all accounts) currently in `from`. */
  count: number;
  busy?: boolean;
  onConfirm(to: string, archive: boolean): void;
  onCancel(): void;
  onCreate(name: string): Promise<void>;
}

/** Inline panel under a category: pick where its transactions go, see how many change, confirm. */
export function MigrateConfirm({
  from,
  targets,
  allCategories,
  count,
  busy,
  onConfirm,
  onCancel,
  onCreate,
}: MigrateConfirmProps) {
  const [to, setTo] = useState('');
  const [archive, setArchive] = useState(true);
  const target = useMemo(() => (to ? findCategory(targets, to) : undefined), [targets, to]);
  const noun = count === 1 ? 'transaction' : 'transactions';

  return (
    <div
      className="mt-0.5 mb-2 flex flex-col gap-3 rounded-lg border border-line bg-surface px-3 py-3"
      role="dialog"
      aria-label={`Move ${from.name} transactions`}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Move everything in “{from.name}” to</span>
        <div className="w-56">
          <CategoryPicker
            value={to}
            categories={targets}
            allCategories={allCategories}
            onChange={setTo}
            onCreate={onCreate}
            aria-label="Move to category"
          />
        </div>
      </div>
      <p className="text-sm" aria-live="polite">
        {!target
          ? 'Choose the category to move them to.'
          : count === 0
            ? `No transactions use “${from.name}”, so nothing will change.`
            : `${count} ${noun} in all accounts will change from “${from.name}” to “${target.name}”.`}
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-accent"
          checked={archive}
          onChange={(event) => setArchive(event.target.checked)}
        />
        Archive “{from.name}” afterwards
      </label>
      <div className="flex justify-end gap-2">
        <ActionButton shortcut="categories.cancel" variant="ghost" onAction={onCancel}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          disabled={!target || busy}
          onAction={() => target && onConfirm(target.name, archive)}
        >
          {busy ? 'Moving…' : count === 0 ? 'Done' : `Move ${count} ${noun}`}
        </ActionButton>
      </div>
    </div>
  );
}

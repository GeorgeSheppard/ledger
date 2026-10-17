import type { Category } from '../../lib/domain/types';
import { selectableRow } from '../accounts/rowStyles';

interface CategoryRowProps {
  category: Category;
  usage: number;
  selected: boolean;
  onOpen(category: Category): void;
}

export function CategoryRow({ category, usage, selected, onOpen }: CategoryRowProps) {
  return (
    <div
      role="row"
      aria-selected={selected}
      data-row-id={category.name}
      className={selectableRow(selected, 'grid grid-cols-[14px_minmax(0,1fr)_auto] gap-3')}
      onClick={() => onOpen(category)}
    >
      <span role="cell" className="size-3.5 rounded-full" style={{ background: category.color }} />
      <span role="cell" className="truncate">
        {category.name}
      </span>
      <span role="cell" className="text-[0.8125rem] text-muted tabular-nums">
        {usage === 0 ? 'Unused' : `${usage} ${usage === 1 ? 'transaction' : 'transactions'}`}
      </span>
    </div>
  );
}

import { isGlobal } from '../../lib/categories/categories';
import type { Category } from '../../lib/domain/types';
import { Badge } from '../../ui/Badge';
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
      <span role="cell" className="flex min-w-0 items-center gap-2">
        <span className="truncate">{category.name}</span>
        {!isGlobal(category) && (
          <Badge title={`Only offered on ${category.accounts!.join(', ')}`}>
            {category.accounts!.length === 1
              ? category.accounts![0]
              : `${category.accounts!.length} accounts`}
          </Badge>
        )}
        {category.excluded && (
          <Badge title="Left out of spending, income and cash flow">Excluded</Badge>
        )}
      </span>
      <span role="cell" className="text-[0.8125rem] text-muted tabular-nums">
        {usage === 0 ? 'Unused' : `${usage} ${usage === 1 ? 'transaction' : 'transactions'}`}
      </span>
    </div>
  );
}

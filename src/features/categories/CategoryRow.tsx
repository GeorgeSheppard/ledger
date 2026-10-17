import type { Category } from '../../lib/domain/types';
import './CategoryRow.css';

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
      className={['category-row', selected && 'category-row--selected'].filter(Boolean).join(' ')}
      onClick={() => onOpen(category)}
    >
      <span role="cell" className="category-row__swatch" style={{ background: category.color }} />
      <span role="cell" className="category-row__name">
        {category.name}
      </span>
      <span role="cell" className="category-row__usage">
        {usage === 0 ? 'Unused' : `${usage} ${usage === 1 ? 'transaction' : 'transactions'}`}
      </span>
    </div>
  );
}

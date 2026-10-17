import type { CSSProperties } from 'react';
import type { Category } from '../../lib/domain/types';
import { categoryColor } from '../../lib/categories/categories';
import './CategoryChip.css';

/** A category name with its colour dot. Renders "Uncategorised" for an empty name. */
export function CategoryChip({ name, categories }: { name: string; categories: Category[] }) {
  if (!name.trim())
    return <span className="category-chip category-chip--empty">Uncategorised</span>;
  return (
    <span
      className="category-chip"
      style={{ '--chip-color': categoryColor(categories, name) } as CSSProperties}
    >
      <span className="category-chip__dot" aria-hidden="true" />
      <span className="category-chip__name">{name}</span>
    </span>
  );
}

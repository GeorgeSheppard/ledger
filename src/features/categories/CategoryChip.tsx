import type { CSSProperties } from 'react';
import { categoryColor } from '../../lib/categories/categories';
import type { Category } from '../../lib/domain/types';

/** A category name with its colour dot. Renders "Uncategorised" for an empty name. */
export function CategoryChip({ name, categories }: { name: string; categories: Category[] }) {
  if (!name.trim()) return <span className="text-sm text-muted">Uncategorised</span>;
  const style = { '--chip': categoryColor(categories, name) } as CSSProperties;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-(--chip)/15 py-0.5 pr-2 pl-1.5 text-[0.8125rem]"
      style={style}
    >
      <span className="size-2 flex-none rounded-full bg-(--chip)" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}

import type { CSSProperties } from 'react';
import { categoryColor } from '../../lib/categories/categories';
import type { Category } from '../../lib/domain/types';
import { cn } from '../../ui/cn';

/** A category name with its colour dot. Renders "Uncategorised" for an empty name. */
export function CategoryChip({
  name,
  categories,
  className,
}: {
  name: string;
  categories: Category[];
  className?: string;
}) {
  if (!name.trim())
    return <span className={cn('text-sm text-muted', className)}>Uncategorised</span>;
  const style = { '--chip': categoryColor(categories, name) } as CSSProperties;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border-2 border-(--chip) bg-(--chip)/20 py-px pr-2 pl-1.5 text-[0.8125rem] font-medium',
        className
      )}
      style={style}
    >
      <span className="size-2.5 flex-none rounded-sm bg-(--chip)" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}

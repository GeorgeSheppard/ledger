import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** Bordered surface for grouping content: tables, charts, forms. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('rounded-md border-2 border-rule bg-surface', className)} />;
}

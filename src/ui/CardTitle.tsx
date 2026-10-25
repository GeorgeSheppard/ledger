import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** Heading for a card: the accent tick marks where each block starts when scanning a page. */
export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...rest}
      className={cn(
        'mb-3 flex items-center justify-between gap-2 border-b-2 border-rule pb-2 text-sm font-bold tracking-wide uppercase',
        className
      )}
    />
  );
}

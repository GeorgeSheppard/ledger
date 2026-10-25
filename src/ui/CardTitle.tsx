import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** Heading for a card: the accent tick marks where each block starts when scanning a page. */
export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...rest}
      className={cn(
        'mb-3 flex items-center gap-2.5 text-lg font-semibold before:h-5 before:w-1 before:shrink-0 before:rounded-full before:bg-accent',
        className
      )}
    />
  );
}

import type { ComponentProps } from 'react';
import { cn } from './cn';

/** The standard dropdown. Accepts every `<select>` prop, including `ref`. */
export function Select({ className, ...rest }: ComponentProps<'select'>) {
  return (
    <select
      {...rest}
      className={cn(
        'rounded-md border-2 border-rule bg-surface px-2 py-1 text-sm text-fg',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        'disabled:opacity-50',
        className
      )}
    />
  );
}

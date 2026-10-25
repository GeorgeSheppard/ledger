import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from './cn';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

/**
 * The standard text field (also used for date and number inputs). Set `aria-invalid` to show the
 * error state.
 */
export function TextInput({ className, ...rest }: TextInputProps) {
  return (
    <input
      {...rest}
      className={cn(
        'h-9 w-full min-w-0 rounded-md border-2 border-rule bg-surface px-2 text-sm text-fg transition-shadow placeholder:text-muted/70',
        'focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none',
        'aria-invalid:border-negative aria-invalid:focus:ring-negative/20',
        className
      )}
    />
  );
}

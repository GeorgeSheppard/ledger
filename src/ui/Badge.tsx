import type { HTMLAttributes } from 'react';
import { cn } from './cn';

const TONES = {
  accent: 'bg-accent/12 text-accent',
  neutral: 'bg-surface-hover text-muted',
  positive: 'bg-positive/12 text-positive',
  negative: 'bg-negative/12 text-negative',
} as const;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof TONES;
}

/** Small rounded label for a status, e.g. "New" or "Can't read". */
export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-block rounded-full px-2 py-px text-xs whitespace-nowrap',
        TONES[tone],
        className
      )}
    />
  );
}

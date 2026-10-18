import { DONATE_COPY, DONATE_URL } from '../lib/donate/donate';
import { cn } from './cn';

/** Quiet, one-line donation prompt; renders nothing until a donation URL is configured. */
export function DonateLink({ className }: { className?: string }) {
  if (!DONATE_URL) return null;
  return (
    <p className={cn('text-sm text-muted', className)}>
      {DONATE_COPY}{' '}
      <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
        Support Ledger
      </a>
    </p>
  );
}

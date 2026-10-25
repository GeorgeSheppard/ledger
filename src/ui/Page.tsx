import type { ReactNode } from 'react';
import { cn } from './cn';

interface PageProps {
  title: string;
  /** Replaces the plain heading, e.g. with one that can be edited. `title` is still the fallback. */
  heading?: ReactNode;
  /** Short line under the title. */
  description?: ReactNode;
  /** Buttons shown at the right of the header, usually `ActionButton`s. */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Standard page frame: header with title and actions, then content. Use for every page. */
export function Page({ title, heading, description, actions, className, children }: PageProps) {
  return (
    <div className={cn('mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8', className)}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {heading ?? <h1 className="text-3xl font-bold tracking-tight">{title}</h1>}
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

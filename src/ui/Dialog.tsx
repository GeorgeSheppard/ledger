import { useEffect, useRef, type ReactNode } from 'react';
import { ActionButton } from './ActionButton';
import { cn } from './cn';

/** A modal on the native `<dialog>`: Escape and the backdrop close it, focus is trapped inside. */
export function Dialog({
  title,
  description,
  onClose,
  children,
  className,
}: {
  title: string;
  description?: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && onClose()}
      aria-label={title}
      className={cn(
        'm-auto max-h-[90dvh] w-[min(40rem,calc(100vw-32px))] overflow-y-auto rounded-xl border border-line bg-canvas p-0 text-fg outline-none backdrop:bg-black/40',
        className
      )}
    >
      <div className="flex flex-col gap-5 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <ActionButton variant="ghost" onAction={onClose}>
            Close
          </ActionButton>
        </header>
        {children}
      </div>
    </dialog>
  );
}

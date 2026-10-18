import { useEffect, useRef } from 'react';
import { SHORTCUTS, type ShortcutId, type ShortcutScope } from '../lib/shortcuts/bindings';
import { Kbd } from './Kbd';

/** Scopes listed in the overlay. Pages outside the app shell (landing, connect) are left out. */
const SCOPE_LABELS: Partial<Record<ShortcutScope, string>> = {
  global: 'Everywhere',
  dashboard: 'Dashboard',
  accounts: 'Accounts',
  transactions: 'Transactions',
  categories: 'Categories',
  import: 'CSV import',
};

/** Modal listing every shortcut, grouped by where it applies. */
export function ShortcutHelp({ onClose }: { onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const ids = Object.keys(SHORTCUTS) as ShortcutId[];
  const scopes = Object.keys(SCOPE_LABELS) as ShortcutScope[];

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label="Keyboard shortcuts"
      className="m-auto max-h-[80dvh] w-[min(480px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-6 text-fg outline-none backdrop:bg-black/40"
    >
      <h2 className="mb-4 text-lg font-semibold">Keyboard shortcuts</h2>
      {scopes.map((scope) => (
        <section key={scope}>
          <h3 className="mt-4 mb-2 text-xs font-medium tracking-wide text-muted uppercase">
            {SCOPE_LABELS[scope]}
          </h3>
          <dl>
            {ids
              .filter((id) => SHORTCUTS[id].scope === scope)
              .map((id) => (
                <div key={id} className="flex justify-between py-1 text-sm">
                  <dt>{SHORTCUTS[id].description}</dt>
                  <dd>
                    <Kbd shortcut={id} className="text-muted" />
                  </dd>
                </div>
              ))}
          </dl>
        </section>
      ))}
    </dialog>
  );
}

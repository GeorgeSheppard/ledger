import { useEffect, useRef } from 'react';
import { SHORTCUTS, type ShortcutId, type ShortcutScope } from '../lib/shortcuts/bindings';
import { Kbd } from './Kbd';
import './ShortcutHelp.css';

const SCOPE_LABELS: Record<ShortcutScope, string> = {
  global: 'Everywhere',
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
      className="shortcut-help"
      onClose={onClose}
      aria-label="Keyboard shortcuts"
    >
      <h2>Keyboard shortcuts</h2>
      {scopes.map((scope) => (
        <section key={scope}>
          <h3>{SCOPE_LABELS[scope]}</h3>
          <dl>
            {ids
              .filter((id) => SHORTCUTS[id].scope === scope)
              .map((id) => (
                <div key={id} className="shortcut-help__row">
                  <dt>{SHORTCUTS[id].description}</dt>
                  <dd>
                    <Kbd shortcut={id} />
                  </dd>
                </div>
              ))}
          </dl>
        </section>
      ))}
    </dialog>
  );
}

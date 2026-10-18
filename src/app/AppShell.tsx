import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import type { ShortcutId } from '../lib/shortcuts/bindings';
import { useSession } from '../state/session';
import { useShortcut } from '../state/shortcuts';
import { Kbd } from '../ui/Kbd';
import { cn } from '../ui/cn';
import { SaveStatus } from '../features/sync/SaveStatus';
import { ShortcutHelp } from '../ui/ShortcutHelp';
import { paths } from './paths';

const NAV: { to: string; label: string; shortcut: ShortcutId }[] = [
  { to: paths.home, label: 'Dashboard', shortcut: 'nav.dashboard' },
  { to: paths.accounts, label: 'Accounts', shortcut: 'nav.accounts' },
  { to: paths.categories, label: 'Categories', shortcut: 'nav.categories' },
  { to: paths.import, label: 'Import CSV', shortcut: 'nav.import' },
];

function NavItem({ to, label, shortcut }: (typeof NAV)[number]) {
  const navigate = useNavigate();
  useShortcut(shortcut, () => navigate(to));
  return (
    <NavLink
      to={to}
      end={to === paths.home}
      className={({ isActive }) =>
        cn(
          'flex items-center justify-between rounded-lg px-2 py-1.5 text-fg no-underline hover:bg-surface-hover',
          isActive && 'bg-surface-hover font-semibold'
        )
      }
    >
      <span>{label}</span>
      <Kbd shortcut={shortcut} className="text-muted max-md:hidden" />
    </NavLink>
  );
}

/** Frame around every signed-in page: sidebar navigation, sheet name, shortcut help. */
export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useSession();
  const [helpOpen, setHelpOpen] = useState(false);
  useShortcut('help.toggle', () => setHelpOpen((open) => !open));

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[220px_1fr]">
      <aside className="flex flex-col gap-4 border-b border-line bg-surface p-4 md:border-r md:border-b-0">
        <div className="text-lg font-bold">Ledger</div>
        {session.status === 'connected' && (
          <NavLink
            to={paths.connect}
            className="truncate text-sm text-muted no-underline hover:text-fg hover:underline"
            title={`${session.spreadsheet.title} (switch spreadsheet)`}
          >
            {session.spreadsheet.title}
          </NavLink>
        )}
        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <SaveStatus />
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-fg"
            onClick={() => setHelpOpen(true)}
          >
            Shortcuts <Kbd shortcut="help.toggle" />
          </button>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-fg"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

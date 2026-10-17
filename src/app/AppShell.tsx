import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import type { ShortcutId } from '../lib/shortcuts/bindings';
import { useSession } from '../state/session';
import { useShortcut } from '../state/shortcuts';
import { Kbd } from '../ui/Kbd';
import { ShortcutHelp } from '../ui/ShortcutHelp';
import { paths } from './paths';
import './AppShell.css';

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
    <NavLink to={to} end={to === paths.home} className="app-shell__nav-item">
      <span>{label}</span>
      <Kbd shortcut={shortcut} />
    </NavLink>
  );
}

/** Frame around every signed-in page: sidebar navigation, sheet name, shortcut help. */
export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useSession();
  const [helpOpen, setHelpOpen] = useState(false);
  useShortcut('help.toggle', () => setHelpOpen((open) => !open));

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">Ledger</div>
        {session.status === 'connected' && (
          <div className="app-shell__sheet" title={session.spreadsheet.title}>
            {session.spreadsheet.title}
          </div>
        )}
        <nav className="app-shell__nav">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="app-shell__footer">
          <button type="button" className="app-shell__link" onClick={() => setHelpOpen(true)}>
            Shortcuts <Kbd shortcut="help.toggle" />
          </button>
          <button type="button" className="app-shell__link" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="app-shell__main">{children}</main>
      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

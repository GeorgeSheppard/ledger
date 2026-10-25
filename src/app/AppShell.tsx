import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { getBinding, type ShortcutId } from '../lib/shortcuts/bindings';
import { useLedger, useSyncStatus } from '../state/ledgerData';
import { useSession } from '../state/session';
import { ExitButton } from './ExitButton';
import { useShortcut } from '../state/shortcuts';
import { DonateLink } from '../ui/DonateLink';
import { Kbd } from '../ui/Kbd';
import { cn } from '../ui/cn';
import { SaveStatus } from '../modules/save/ui/SaveStatus';
import { paths } from './paths';

const NAV: { to: string; label: string; shortcut: ShortcutId }[] = [
  { to: paths.home, label: 'Dashboard', shortcut: 'nav.dashboard' },
  { to: paths.accounts, label: 'Accounts', shortcut: 'nav.accounts' },
  { to: paths.categories, label: 'Categories', shortcut: 'nav.categories' },
  { to: paths.paychecks, label: 'Paychecks', shortcut: 'nav.paychecks' },
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
          'relative flex items-center justify-between rounded-lg px-3 py-2 text-fg no-underline hover:bg-surface-hover max-md:shrink-0',
          isActive &&
            'bg-accent/15 font-semibold text-accent before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-accent hover:bg-accent/20'
        )
      }
    >
      <span>{label}</span>
      <Kbd shortcut={shortcut} className="text-muted" />
    </NavLink>
  );
}

/** Link to the sheet report, which says what became of each tab. Flags tabs that were not read. */
function SheetReportLink() {
  const navigate = useNavigate();
  const { tabReports } = useLedger();
  useShortcut('nav.sheets', () => navigate(paths.sheets));
  const unread = tabReports.filter((tab) => !tab.imported).length;
  return (
    <NavLink
      to={paths.sheets}
      title={getBinding('nav.sheets').description}
      className={({ isActive }) =>
        cn(
          'rounded px-1 py-0.5 text-muted underline-offset-2 hover:text-fg hover:underline',
          isActive && 'font-semibold text-fg'
        )
      }
    >
      {unread > 0 ? `${unread} tab${unread === 1 ? '' : 's'} not read` : 'Tab report'}
    </NavLink>
  );
}

/** The connected spreadsheet: what it is, whether it is saved, and what you can do with it. */
function SpreadsheetPanel({ title, id, isFile }: { title: string; id: string; isFile: boolean }) {
  const navigate = useNavigate();
  const { closeFile } = useSession();
  const { status } = useSyncStatus();
  const leave = () => {
    if (!isFile) return navigate(paths.connect);
    const unsaved = status.state === 'unsaved' || status.state === 'error';
    if (
      !unsaved ||
      window.confirm('You have changes that are not downloaded. Close the file anyway?')
    )
      closeFile();
  };
  useEffect(() => {
    document.title = `${title} · Ledger`;
    return () => {
      document.title = 'Ledger';
    };
  }, [title]);
  const openUrl = isFile || id === 'demo' ? null : `https://docs.google.com/spreadsheets/d/${id}`;
  return (
    <section
      aria-label="Spreadsheet"
      className="flex flex-col gap-3 rounded-lg border border-line bg-canvas p-3"
    >
      <div className="min-w-0">
        <div className="text-xs font-medium tracking-wide text-muted uppercase">
          {isFile ? 'File' : 'Spreadsheet'}
        </div>
        {openUrl ? (
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            title={`Open ${title} in Google Sheets`}
            className="block truncate font-semibold text-fg no-underline hover:underline"
          >
            {title} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <div className="truncate font-semibold" title={title}>
            {title}
          </div>
        )}
      </div>
      <SaveStatus buttonClassName="w-full justify-center" />
      <div className="flex items-center justify-between gap-2 border-t border-line pt-2 text-xs">
        <SheetReportLink />
        <button
          type="button"
          className="cursor-pointer rounded px-1 py-0.5 text-muted underline-offset-2 hover:text-fg hover:underline"
          onClick={leave}
        >
          {isFile ? 'Close file' : 'Switch'}
        </button>
      </div>
    </section>
  );
}

/** Frame around every signed-in page: sidebar navigation (a top bar on phones) and sheet name. */
export function AppShell({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[220px_1fr]">
      <aside className="flex flex-col gap-4 border-b border-line bg-surface p-4 max-md:gap-2 max-md:py-2 md:sticky md:top-0 md:h-dvh md:self-start md:overflow-y-auto md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden="true" className="size-5 rounded-md bg-accent" />
            Ledger
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-line px-2.5 py-1 text-sm md:hidden"
            aria-expanded={menuOpen}
            aria-controls="shell-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close' : 'Spreadsheet'}
          </button>
        </div>
        <div
          id="shell-menu"
          className={cn('flex-col gap-4 md:flex', menuOpen ? 'flex' : 'max-md:hidden')}
        >
          {session.status === 'connected' && (
            <SpreadsheetPanel
              title={session.spreadsheet.title}
              id={session.spreadsheet.id}
              isFile={session.file === true}
            />
          )}
          <div className="flex flex-col gap-2 md:hidden">
            <DonateLink className="text-xs" />
            {session.status === 'connected' && <ExitButton className="w-full justify-start" />}
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 max-md:-mx-1 max-md:flex-row max-md:overflow-x-auto">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 max-md:hidden">
          <DonateLink className="text-xs" />
          {session.status === 'connected' && <ExitButton className="w-full justify-start" />}
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}

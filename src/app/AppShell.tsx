import { useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { getBinding, type ShortcutId } from '../lib/shortcuts/bindings';
import { useLedger, useSyncStatus } from '../state/ledgerData';
import { useHistory, useHistoryNotice, useHistoryState } from '../state/history';
import { useSession } from '../state/session';
import { ExitButton } from './ExitButton';
import { useShortcut } from '../state/shortcuts';
import { DonateLink } from '../ui/DonateLink';
import { Kbd } from '../ui/Kbd';
import { Menu } from '../ui/Menu';
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
      title={getBinding(shortcut).description}
      className={({ isActive }) =>
        cn(
          'flex shrink-0 items-center gap-2 border-b-4 border-transparent px-0.5 py-3.5 text-sm text-fg no-underline hover:border-line',
          isActive && 'border-fg font-bold hover:border-fg'
        )
      }
    >
      <span>{label}</span>
      <Kbd shortcut={shortcut} className="text-muted max-xl:hidden" />
    </NavLink>
  );
}

/** Says what the last undo or redo did, for a moment, wherever the user is on the page. */
function HistoryNotice() {
  const notice = useHistoryNotice();
  return (
    <div role="status" aria-live="polite" className="contents">
      {notice && (
        <p className="fixed bottom-4 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 truncate rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg">
          {notice}
        </p>
      )}
    </div>
  );
}

/** The connected spreadsheet: its name, whether it is saved, and the actions on it. */
function SpreadsheetTools({ title, id, isFile }: { title: string; id: string; isFile: boolean }) {
  const navigate = useNavigate();
  const { closeFile } = useSession();
  const { status } = useSyncStatus();
  const { tabReports } = useLedger();
  const history = useHistory();
  const { undoLabel, redoLabel } = useHistoryState();
  useShortcut('nav.sheets', () => navigate(paths.sheets));
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
  const unread = tabReports.filter((tab) => !tab.imported).length;
  const openUrl = isFile || id === 'demo' ? null : `https://docs.google.com/spreadsheets/d/${id}`;
  const name = (
    <>
      <span className="block text-[0.6875rem] leading-none font-semibold tracking-wide text-muted uppercase">
        {isFile ? 'File' : 'Spreadsheet'}
      </span>
      <span className="block truncate font-semibold">
        {title}
        {openUrl && <span aria-hidden="true"> ↗</span>}
      </span>
    </>
  );
  return (
    <section aria-label="Spreadsheet" className="flex min-w-0 items-center gap-3">
      <div className="max-w-[9rem] min-w-0 text-sm sm:max-w-[16rem]" title={title}>
        {openUrl ? (
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            title={`Open ${title} in Google Sheets`}
            className="block text-fg no-underline hover:underline"
          >
            {name}
          </a>
        ) : (
          name
        )}
      </div>
      <SaveStatus
        className="flex-row items-center gap-3"
        labelClassName="max-lg:sr-only"
        buttonClassName="justify-center"
      />
      <Menu
        label="Spreadsheet actions"
        buttonClassName="border-2 border-rule"
        items={[
          {
            label: undoLabel ? `Undo ${undoLabel}` : 'Undo',
            disabled: !undoLabel,
            onSelect: () => history.undo(),
          },
          {
            label: redoLabel ? `Redo ${redoLabel}` : 'Redo',
            disabled: !redoLabel,
            onSelect: () => history.redo(),
          },
          {
            label: unread > 0 ? `Tab report (${unread} not read)` : 'Tab report',
            separated: true,
            onSelect: () => navigate(paths.sheets),
          },
          { label: isFile ? 'Close file' : 'Switch spreadsheet', onSelect: leave },
        ]}
      />
    </section>
  );
}

/** Frame around every signed-in page: a bar across the top with navigation and the spreadsheet. */
export function AppShell({ children }: { children: ReactNode }) {
  const { session } = useSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="ledger-bar sticky top-0 z-30 border-b border-line bg-bar text-fg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-0 px-4 pt-2 md:flex-nowrap md:px-8 md:pt-0">
          <div className="text-lg font-bold tracking-tight">Ledger</div>
          <nav
            aria-label="Pages"
            className="order-3 -mx-1 flex w-full gap-5 overflow-x-auto px-1 md:order-2 md:mx-0 md:w-auto md:flex-1 md:px-0"
          >
            {NAV.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
          {session.status === 'connected' && (
            <div className="order-2 ml-auto min-w-0 py-2 md:order-3">
              <SpreadsheetTools
                title={session.spreadsheet.title}
                id={session.spreadsheet.id}
                isFile={session.file === true}
              />
            </div>
          )}
        </div>
      </header>
      <main className="min-w-0 flex-1">{children}</main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t-2 border-rule px-4 py-3 md:px-8">
        <DonateLink className="text-xs" />
        {session.status === 'connected' && <ExitButton />}
      </footer>
      {session.status === 'connected' && <HistoryNotice />}
    </div>
  );
}

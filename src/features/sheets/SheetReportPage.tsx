import { useCallback, useId, useState } from 'react';
import { paths } from '../../app/paths';
import { ACCOUNT_COLUMNS } from '../../lib/domain/types';
import type { TabReport } from '../../lib/store/ledgerData';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { FloatingPanel } from '../../ui/FloatingPanel';
import { Page } from '../../ui/Page';
import { useLedger } from '../../state/ledgerData';
import { Link } from 'react-router';

const KIND_LABELS: Record<TabReport['kind'], string> = {
  account: 'Account',
  settings: 'Settings',
  categories: 'Categories',
  paychecks: 'Paychecks',
  reserved: 'Reserved',
};

/** One tab: its name and status. The reason shows in a larger panel on hover, focus or tap. */
function TabRow({ tab }: { tab: TabReport }) {
  const [anchor, setAnchor] = useState<HTMLLIElement | null>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const dismiss = useCallback(() => setOpen(false), []);
  return (
    <li
      ref={setAnchor}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      className="flex cursor-default items-center justify-between gap-3 px-4 py-3 outline-none hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      onPointerEnter={(event) => event.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen(true)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.nativeEvent.stopPropagation();
        setOpen(false);
      }}
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold" title={tab.title}>
          {tab.title}
        </span>
        <span className="text-sm text-muted">{KIND_LABELS[tab.kind]}</span>
      </span>
      <Badge tone={tab.imported ? 'positive' : 'negative'}>
        {tab.imported ? 'Imported' : 'Not imported'}
      </Badge>
      {open && (
        <FloatingPanel
          anchor={anchor}
          onDismiss={dismiss}
          placement="bottom-start"
          dismissOnScroll={false}
          id={id}
          role="tooltip"
          className="max-w-md p-4 text-sm"
        >
          <div className="mb-1 font-semibold">
            {tab.imported ? 'Why this tab was imported' : 'Why this tab was not imported'}
          </div>
          <p className="text-muted">{tab.reason}</p>
        </FloatingPanel>
      )}
    </li>
  );
}

/**
 * `/sheets`: every tab in the spreadsheet and what loading did with it, so a tab that did not show
 * up as an account can be explained. The reasons come from the loader itself, not a second check.
 */
export function SheetReportPage() {
  const { tabReports } = useLedger();
  const imported = tabReports.filter((tab) => tab.imported).length;
  return (
    <Page
      title="How tabs were read"
      description={
        tabReports.length > 0
          ? `${imported} of ${tabReports.length} tabs imported when the spreadsheet was loaded. Hover, focus or tap a row to see why.`
          : undefined
      }
    >
      {tabReports.length === 0 ? (
        <Card className="p-4 text-sm text-muted">
          There is no report for this spreadsheet yet. Reopen it from{' '}
          <Link to={paths.connect}>Switch spreadsheet</Link> to build one.
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {tabReports.map((tab) => (
              <TabRow key={tab.title} tab={tab} />
            ))}
          </ul>
        </Card>
      )}
      <p className="text-sm text-muted">
        A tab becomes an account only if row 1 is exactly {ACCOUNT_COLUMNS.join(' | ')} and every
        row below has a valid date and a number for the amount. Fix the tab in your spreadsheet and
        reopen it to read it again.
      </p>
    </Page>
  );
}

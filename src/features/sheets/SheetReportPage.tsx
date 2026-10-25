import { paths } from '../../app/paths';
import { ACCOUNT_COLUMNS } from '../../lib/domain/types';
import type { TabReport } from '../../lib/store/ledgerData';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { Page } from '../../ui/Page';
import { useLedger } from '../../state/ledgerData';
import { Link } from 'react-router';

const KIND_LABELS: Record<TabReport['kind'], string> = {
  account: 'Account',
  settings: 'Settings',
  categories: 'Categories',
  dashboard: 'Dashboard',
  paychecks: 'Paychecks',
  reserved: 'Reserved',
};

function TabRow({ tab }: { tab: TabReport }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3 md:grid md:grid-cols-[minmax(0,1fr)_110px_110px_minmax(0,2fr)] md:items-start md:gap-3">
      <span className="truncate font-semibold" title={tab.title}>
        {tab.title}
      </span>
      <span className="text-sm text-muted">{KIND_LABELS[tab.kind]}</span>
      <span>
        <Badge tone={tab.imported ? 'positive' : 'negative'}>
          {tab.imported ? 'Imported' : 'Not imported'}
        </Badge>
      </span>
      <span className="text-sm text-muted">{tab.reason}</span>
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
          ? `${imported} of ${tabReports.length} tabs imported when the spreadsheet was loaded.`
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

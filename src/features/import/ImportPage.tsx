import { Link } from 'react-router';
import { paths } from '../../app/paths';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { Page } from '../../ui/Page';
import { DropZone } from './DropZone';
import { ImportPreview } from './ImportPreview';
import { MappingEditor } from './MappingEditor';
import { useCsvImport } from './useCsvImport';

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Drop a bank CSV, check how its columns were read, see what is new, and import it. */
export function ImportPage() {
  const importer = useCsvImport();
  const { file, mapping, plan, result } = importer;

  return (
    <Page
      title="Import CSV"
      description="Add a bank export to one of your accounts. Rows already in the account are skipped."
    >
      {importer.loadError && (
        <p className="text-sm text-negative" role="alert">
          Couldn't load your accounts: {importer.loadError.message}
        </p>
      )}

      {result && (
        <Card className="border-positive/40 bg-positive/8 px-4 py-3 text-sm" role="status">
          <p>
            Added {plural(result.added, 'transaction')} to{' '}
            <Link to={paths.account(result.account.id)}>{result.account.name}</Link>
            {result.skipped > 0 && `, skipped ${result.skipped} already there`}
            {result.categoriesAdded > 0 &&
              `, and created ${plural(result.categoriesAdded, 'new category', 'new categories')}`}
            .
          </p>
        </Card>
      )}

      <DropZone onFile={importer.loadFile} compact={!!file} fileName={file?.name} />

      {importer.error && (
        <p className="text-sm text-negative" role="alert">
          {importer.error}
        </p>
      )}

      {file && mapping && (
        <>
          {importer.accounts.length === 0 ? (
            <p className="text-sm text-negative">
              There are no accounts yet. <Link to={paths.accounts}>Create one</Link> first.
            </p>
          ) : (
            <MappingEditor
              table={file.table}
              mapping={mapping}
              onMappingChange={importer.setMapping}
              onHasHeaderChange={importer.setHasHeader}
              accounts={importer.accounts}
              accountId={importer.accountId}
              onAccountChange={importer.setAccountId}
            />
          )}

          {plan?.problems.map((problem) => (
            <p key={problem} className="text-sm text-negative">
              {problem}
            </p>
          ))}
          {plan && plan.problems.length === 0 && <ImportPreview plan={plan} />}
          {!plan && importer.loading && <p className="text-sm text-muted">Checking the account…</p>}

          <footer className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-canvas py-3">
            <p className="flex-1 text-sm text-muted">
              {plan && plan.problems.length === 0 && (
                <>
                  {plural(plan.counts.new, 'new transaction')}
                  {plan.counts.existing > 0 && ` · ${plan.counts.existing} already in account`}
                  {plan.counts.invalid > 0 && ` · ${plan.counts.invalid} can't be read`}
                  {plan.newCategories.length > 0 &&
                    ` · adds ${plan.newCategories.length === 1 ? 'category' : 'categories'} ${plan.newCategories.join(', ')}`}
                </>
              )}
            </p>
            <ActionButton shortcut="import.reset" variant="ghost" onAction={importer.reset}>
              Start over
            </ActionButton>
            <ActionButton
              shortcut="import.confirm"
              variant="primary"
              disabled={!plan || plan.toAdd.length === 0 || importer.importing}
              onAction={importer.confirm}
            >
              {importer.importing
                ? 'Importing…'
                : `Import ${plural(plan?.toAdd.length ?? 0, 'transaction')}`}
            </ActionButton>
          </footer>
        </>
      )}
    </Page>
  );
}

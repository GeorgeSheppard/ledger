import { useEffect, useRef } from 'react';
import type { Account, Category, Transaction } from '../../lib/domain/types';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { DropZone } from './DropZone';
import { ImportPreview } from './ImportPreview';
import { MappingEditor } from './MappingEditor';
import { useCsvImport } from './useCsvImport';

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

interface ImportDialogProps {
  account: Account;
  /** The account's current transactions, used to skip rows already there. */
  transactions: Transaction[];
  categories: Category[];
  onClose(): void;
}

/**
 * Modal for importing a bank export into one account: drop or choose a file, check how its
 * columns were read, see what is new, and import it.
 */
export function ImportDialog({ account, transactions, categories, onClose }: ImportDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const importer = useCsvImport(account.id, transactions, categories);
  const { file, mapping, plan, result } = importer;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label={`Import data into ${account.name}`}
      className="m-auto max-h-[90dvh] w-[min(64rem,calc(100vw-32px))] overflow-y-auto rounded-xl border border-line bg-canvas p-0 text-fg outline-none backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-5 p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Import data into {account.name}</h2>
            <p className="mt-1 text-sm text-muted">
              Add a CSV export from your bank. Rows already in the account are skipped.
            </p>
          </div>
          <ActionButton shortcut="import.close" variant="ghost" onAction={onClose}>
            Close
          </ActionButton>
        </header>

        {result && (
          <Card className="border-positive/40 bg-positive/8 px-4 py-3 text-sm" role="status">
            <p>
              Added {plural(result.added, 'transaction')} to {account.name}
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
            <MappingEditor
              table={file.table}
              mapping={mapping}
              onMappingChange={importer.setMapping}
              onHasHeaderChange={importer.setHasHeader}
            />

            {plan?.problems.map((problem) => (
              <p key={problem} className="text-sm text-negative">
                {problem}
              </p>
            ))}
            {plan && plan.problems.length === 0 && <ImportPreview plan={plan} />}

            <footer className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center gap-3 border-t border-line bg-canvas px-6 py-3">
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
                onAction={() => void importer.confirm()}
              >
                {importer.importing
                  ? 'Importing…'
                  : `Import ${plural(plan?.toAdd.length ?? 0, 'transaction')}`}
              </ActionButton>
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}

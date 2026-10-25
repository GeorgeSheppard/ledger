import { useEffect, useMemo, useRef, useState } from 'react';
import { netPay, type PaycheckList } from '../../../lib/paychecks/paychecks';
import { formatDay } from '../../../lib/transactions/dates';
import { ActionButton } from '../../../ui/ActionButton';
import { Card } from '../../../ui/Card';
import { oldPaychecksImporter, mergeImported } from '../old-paychecks';
import type { PaycheckImport } from '../types';
import { formatAmount as formatMoney } from './format';

interface ImportPaychecksDialogProps {
  /** The paychecks already saved, so repeats are skipped. */
  list: PaycheckList;
  /** Saves the merged list. */
  onSave(list: PaycheckList): Promise<void>;
  onClose(): void;
}

/**
 * Modal for moving payslips over from the old paycheck spreadsheet: paste its rows (copied from the
 * sheet) or choose an exported CSV, check what was read, and add them.
 */
export function ImportPaychecksDialog({ list, onSave, onClose }: ImportPaychecksDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const read = useMemo<{ value: PaycheckImport | null; error: string | null }>(() => {
    if (text.trim() === '') return { value: null, error: null };
    try {
      return {
        value: oldPaychecksImporter.parse({ name: fileName ?? 'Pasted text', text }),
        error: null,
      };
    } catch (cause) {
      return { value: null, error: cause instanceof Error ? cause.message : String(cause) };
    }
  }, [text, fileName]);

  const merged = useMemo(
    () => (read.value ? mergeImported(list, read.value.paychecks) : null),
    [list, read.value]
  );

  const add = async () => {
    if (!merged) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(merged.list);
      onClose();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : String(cause));
      setSaving(false);
    }
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label="Import old paychecks"
      className="m-auto max-h-[90dvh] w-[min(48rem,calc(100vw-32px))] overflow-y-auto rounded-xl border border-line bg-canvas p-0 text-fg outline-none backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Import old paychecks</h2>
            <p className="mt-1 text-sm text-muted">
              Copy the rows from your old sheet (with the header row) and paste them here, or choose
              a CSV export. Columns: Date, Tax Code, Tax Year, Total Income, Pension (Salary
              Sacrifice), Pension (Employer), Taxable Benefits, Income Tax, NI, Student Loan,
              Donations, Take Home.
            </p>
          </div>
          <ActionButton variant="ghost" onAction={onClose}>
            Close
          </ActionButton>
        </header>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{fileName ?? 'Pasted rows'}</span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFileName(null);
            }}
            rows={6}
            spellCheck={false}
            className="w-full resize-y rounded-lg border border-line bg-canvas p-2 font-mono text-sm text-fg focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none"
          />
        </label>
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          aria-label="Choose a CSV file"
          onChange={(e) => void chooseFile(e.target.files?.[0])}
          className="text-sm"
        />

        {read.error && (
          <p className="text-sm text-negative" role="alert">
            {read.error}
          </p>
        )}
        {read.value && merged && (
          <>
            <Card className="overflow-x-auto" aria-label="Preview">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 text-right font-medium">Income</th>
                    <th className="px-3 py-2 text-right font-medium">Benefit in kind</th>
                    <th className="px-3 py-2 text-right font-medium">Deductions</th>
                    <th className="px-3 py-2 text-right font-medium">Take-home</th>
                  </tr>
                </thead>
                <tbody>
                  {read.value.paychecks.map((p) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className="px-3 py-1.5">{formatDay(p.date)}</td>
                      <td className="px-3 py-1.5 text-right">
                        {formatMoney(p.income.reduce((t, l) => t + l.amount, 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {formatMoney(p.benefits.reduce((t, l) => t + l.amount, 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {formatMoney(p.deductions.reduce((t, l) => t + l.amount, 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold">
                        {formatMoney(netPay(p))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            {read.value.warnings.length > 0 && (
              <Card className="flex flex-col gap-1 px-4 py-3 text-sm" aria-label="Check these">
                {read.value.warnings.map((w) => (
                  <p key={w} role="status">
                    {w}
                  </p>
                ))}
              </Card>
            )}
          </>
        )}
        {saveError && (
          <p className="text-sm text-negative" role="alert">
            Could not save: {saveError}
          </p>
        )}

        <footer className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-muted">
            {merged &&
              `${merged.added} new paycheck${merged.added === 1 ? '' : 's'}${
                merged.skipped > 0 ? ` · ${merged.skipped} already added` : ''
              }`}
          </p>
          <ActionButton
            variant="primary"
            disabled={!merged || merged.added === 0 || saving}
            onAction={() => void add()}
          >
            {saving ? 'Adding…' : 'Add paychecks'}
          </ActionButton>
        </footer>
      </div>
    </dialog>
  );
}

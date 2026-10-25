import { useEffect, useMemo, useRef, useState } from 'react';
import { PAYCHECKS_TAB } from '../../lib/domain/types';
import {
  addPaycheck,
  netPay,
  newPaycheck,
  removePaycheck,
  replacePaycheck,
  totalBenefits,
  totalDeductions,
  totalIncome,
  type PayLine,
  type PaycheckList,
  type Paycheck,
} from '../../lib/paychecks/paychecks';
import { formatDay, todayIso, yearOf } from '../../lib/transactions/dates';
import { useShortcut } from '../../state/shortcuts';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { Page } from '../../ui/Page';
import { cn } from '../../ui/cn';
import { DeleteConfirm } from '../accounts/DeleteConfirm';
import { formatMoney } from '../../modules/graphs/shared/format';
import { PaycheckEditor } from './PaycheckEditor';
import { usePaychecks } from './usePaychecks';

function LineChips({ lines }: { lines: PayLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 text-xs">
      {lines.map((l) => (
        <li key={l.id} className="rounded-full border border-line px-2 py-0.5">
          {l.name} <span className="text-muted tabular-nums">{formatMoney(l.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function PaycheckCard({
  paycheck,
  selected,
  onSelect,
  onEdit,
}: {
  paycheck: Paycheck;
  selected: boolean;
  onSelect(): void;
  onEdit(): void;
}) {
  const hasBenefits = paycheck.benefits.length > 0;
  return (
    <Card
      data-row-id={paycheck.id}
      aria-current={selected || undefined}
      className={cn('cursor-pointer p-4', selected && 'outline-2 outline-offset-2 outline-accent')}
      onClick={onSelect}
      onDoubleClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">
          {formatDay(paycheck.date)} {yearOf(paycheck.date)}
          {paycheck.taxCode && (
            <span className="ml-2 text-xs font-normal text-muted">{paycheck.taxCode}</span>
          )}
        </h2>
        <ActionButton
          variant="ghost"
          aria-label={`Edit paycheck from ${formatDay(paycheck.date)} ${yearOf(paycheck.date)}`}
          onAction={onEdit}
        >
          Edit
        </ActionButton>
      </div>
      <dl className={cn('mt-3 grid gap-3 text-sm', hasBenefits ? 'grid-cols-4' : 'grid-cols-3')}>
        <div>
          <dt className="text-muted">Income</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(totalIncome(paycheck))}</dd>
        </div>
        {hasBenefits && (
          <div>
            <dt className="text-muted">Benefit in kind</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(totalBenefits(paycheck))}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted">Deductions</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(totalDeductions(paycheck))}</dd>
        </div>
        <div>
          <dt className="text-muted">Take-home</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(netPay(paycheck))}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-col gap-1.5">
        <LineChips lines={paycheck.income} />
        <LineChips lines={paycheck.benefits} />
        <LineChips lines={paycheck.deductions} />
      </div>
    </Card>
  );
}

/** `/paychecks`: payslips typed in line by line, so the dashboard can follow pay from gross to spending. */
export function PaychecksPage() {
  const { list, save } = usePaychecks();
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    paycheck: Paycheck;
    /** Whether this is a new entry rather than an edit of a saved one. */
    isNew: boolean;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Newest first, like a statement.
  const paychecks = useMemo(() => [...list.paychecks].reverse(), [list]);
  const current = paychecks.find((p) => p.id === selected);
  const browsing = !editor && !confirmDelete;

  useEffect(() => {
    if (!selected) return;
    listRef.current
      ?.querySelector(`[data-row-id="${CSS.escape(selected)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const persist = async (next: PaycheckList, then?: () => void) => {
    setError(null);
    try {
      await save(next);
      then?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const startNew = () => setEditor({ paycheck: newPaycheck(list, todayIso()), isNew: true });
  const edit = (paycheck: Paycheck | undefined) =>
    paycheck && setEditor({ paycheck, isNew: false });
  const step = (delta: number) => {
    if (!paychecks.length) return;
    const index = paychecks.findIndex((p) => p.id === selected);
    const next = index < 0 ? 0 : Math.max(0, Math.min(paychecks.length - 1, index + delta));
    setSelected(paychecks[next]!.id);
  };

  const onSave = (paycheck: Paycheck) => {
    void persist(
      editor?.isNew ? addPaycheck(list, paycheck) : replacePaycheck(list, paycheck),
      () => {
        setSelected(paycheck.id);
        setEditor(null);
      }
    );
  };
  const onDelete = () => {
    if (!current) return;
    const index = paychecks.findIndex((p) => p.id === current.id);
    const neighbour = paychecks[index + 1] ?? paychecks[index - 1];
    void persist(removePaycheck(list, current.id), () => {
      setSelected(neighbour?.id ?? null);
      setConfirmDelete(false);
    });
  };

  useShortcut('paychecks.new', startNew, browsing);
  useShortcut('paychecks.down', () => step(1), browsing);
  useShortcut('paychecks.up', () => step(-1), browsing);
  useShortcut('paychecks.edit', () => edit(current), browsing && !!current);
  useShortcut('paychecks.delete', () => setConfirmDelete(true), browsing && !!current);
  useShortcut('paychecks.cancel', () => setConfirmDelete(false), confirmDelete);

  return (
    <Page
      title="Paychecks"
      className="max-w-3xl"
      description={
        <>
          Enter a payslip line by line: what you were paid, and what was taken out. The dashboard
          follows your pay from gross to take-home and on to spending. Stored in the{' '}
          <code className="font-mono">{PAYCHECKS_TAB}</code> tab of your sheet.
        </>
      }
      actions={
        <>
          <ActionButton
            shortcut="paychecks.new"
            variant="primary"
            disabled={!browsing}
            onAction={startNew}
          >
            Add paycheck
          </ActionButton>
        </>
      }
    >
      {error && (
        <p role="alert" className="text-sm text-negative">
          Could not save: {error}
        </p>
      )}
      {paychecks.length === 0 ? (
        <Card className="p-6 text-sm text-muted">
          <p className="font-medium text-fg">No paychecks yet</p>
          <p className="mt-1">
            Add a paycheck: each income line, such as salary or an allowance, then tax, pension and
            the rest. The dashboard then follows your pay through to spending.
          </p>
        </Card>
      ) : (
        <>
          <div ref={listRef} className="flex flex-col gap-3" aria-label="Paychecks">
            {paychecks.map((paycheck) => (
              <div key={paycheck.id}>
                <PaycheckCard
                  paycheck={paycheck}
                  selected={paycheck.id === selected}
                  onSelect={() => browsing && setSelected(paycheck.id)}
                  onEdit={() => browsing && edit(paycheck)}
                />
                {confirmDelete && paycheck.id === selected && (
                  <DeleteConfirm
                    message={`Delete the paycheck from ${formatDay(paycheck.date)} ${yearOf(paycheck.date)}? The dashboard will no longer count it.`}
                    deleteShortcut="paychecks.delete"
                    cancelShortcut="paychecks.cancel"
                    onConfirm={onDelete}
                    onCancel={() => setConfirmDelete(false)}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {editor && (
        <PaycheckEditor
          key={editor.paycheck.id + (editor.isNew ? 'new' : '')}
          paycheck={editor.paycheck}
          isNew={editor.isNew}
          list={list}
          onSave={onSave}
          onCancel={() => setEditor(null)}
        />
      )}
    </Page>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { PAYCHECKS_TAB } from '../../lib/domain/types';
import {
  addPaycheck,
  copyPaycheck,
  netPay,
  newPaycheck,
  nextMonth,
  removePaycheck,
  replacePaycheck,
  totalDeductions,
  totalIncome,
  type PayLine,
  type PaycheckList,
  type Paycheck,
} from '../../lib/paychecks/paychecks';
import type { MonthKey } from '../../lib/metrics/months';
import { formatMonth, todayIso } from '../../lib/transactions/dates';
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
  return (
    <Card
      data-row-id={paycheck.month}
      aria-current={selected || undefined}
      className={cn('cursor-pointer p-4', selected && 'outline-2 outline-offset-2 outline-accent')}
      onClick={onSelect}
      onDoubleClick={onEdit}
    >
      <h2 className="font-semibold">{formatMonth(paycheck.month)}</h2>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted">Income</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(totalIncome(paycheck))}</dd>
        </div>
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
        <LineChips lines={paycheck.deductions} />
      </div>
    </Card>
  );
}

/** `/paychecks`: one payslip per month, so the dashboard can follow pay from gross to spending. */
export function PaychecksPage() {
  const { list, save } = usePaychecks();
  const [selected, setSelected] = useState<MonthKey | null>(null);
  const [editor, setEditor] = useState<{
    paycheck: Paycheck;
    /** The month being edited, or null for a new entry. */
    editing: MonthKey | null;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Newest first, like a statement.
  const paychecks = useMemo(() => [...list.paychecks].reverse(), [list]);
  const current = paychecks.find((p) => p.month === selected);
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

  const month = nextMonth(list, todayIso());
  const startNew = () => setEditor({ paycheck: newPaycheck(month), editing: null });
  const startCopy = () => setEditor({ paycheck: copyPaycheck(list, month), editing: null });
  const edit = (paycheck: Paycheck | undefined) =>
    paycheck && setEditor({ paycheck, editing: paycheck.month });
  const step = (delta: number) => {
    if (!paychecks.length) return;
    const index = paychecks.findIndex((p) => p.month === selected);
    const next = index < 0 ? 0 : Math.max(0, Math.min(paychecks.length - 1, index + delta));
    setSelected(paychecks[next]!.month);
  };

  const onSave = (paycheck: Paycheck) => {
    const editing = editor?.editing ?? null;
    void persist(
      editing === null ? addPaycheck(list, paycheck) : replacePaycheck(list, editing, paycheck),
      () => {
        setSelected(paycheck.month);
        setEditor(null);
      }
    );
  };
  const onDelete = () => {
    if (!current) return;
    const index = paychecks.findIndex((p) => p.month === current.month);
    const neighbour = paychecks[index + 1] ?? paychecks[index - 1];
    void persist(removePaycheck(list, current.month), () => {
      setSelected(neighbour?.month ?? null);
      setConfirmDelete(false);
    });
  };

  useShortcut('paychecks.new', startNew, browsing);
  useShortcut('paychecks.copy', startCopy, browsing && paychecks.length > 0);
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
          Enter each month&apos;s payslip: what you were paid, and what was taken out. The dashboard
          can then follow your money from gross pay to spending. Stored in the{' '}
          <code className="font-mono">{PAYCHECKS_TAB}</code> tab of your sheet.
        </>
      }
      actions={
        <>
          {paychecks.length > 0 && (
            <ActionButton shortcut="paychecks.copy" disabled={!browsing} onAction={startCopy}>
              Copy last month
            </ActionButton>
          )}
          <ActionButton
            shortcut="paychecks.new"
            variant="primary"
            disabled={!browsing}
            onAction={startNew}
          >
            Add {formatMonth(month)}
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
            Add a month to see where your pay goes: each income line, such as salary or an
            allowance, then tax, pension and the rest, and what you spend. Next month, copy the last
            one and change what moved.
          </p>
        </Card>
      ) : (
        <div ref={listRef} className="flex flex-col gap-3" aria-label="Paychecks">
          {paychecks.map((paycheck) => (
            <div key={paycheck.month}>
              <PaycheckCard
                paycheck={paycheck}
                selected={paycheck.month === selected}
                onSelect={() => browsing && setSelected(paycheck.month)}
                onEdit={() => browsing && edit(paycheck)}
              />
              {confirmDelete && paycheck.month === selected && (
                <DeleteConfirm
                  message={`Delete ${formatMonth(paycheck.month)}? The dashboard will no longer count it.`}
                  deleteShortcut="paychecks.delete"
                  cancelShortcut="paychecks.cancel"
                  onConfirm={onDelete}
                  onCancel={() => setConfirmDelete(false)}
                />
              )}
            </div>
          ))}
        </div>
      )}
      {editor && (
        <PaycheckEditor
          key={editor.editing ?? 'new'}
          paycheck={editor.paycheck}
          isNew={editor.editing === null}
          list={list}
          onSave={onSave}
          onCancel={() => setEditor(null)}
        />
      )}
    </Page>
  );
}

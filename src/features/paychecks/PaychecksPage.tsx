import { useEffect, useRef, useState } from 'react';
import { PAYCHECKS_TAB, type Account } from '../../lib/domain/types';
import {
  addPaycheck,
  netPay,
  newPaycheck,
  removePaycheck,
  replacePaycheck,
  REPEAT_LABELS,
  totalDeductions,
  type Paycheck,
} from '../../lib/paychecks/paychecks';
import { formatDay, todayIso } from '../../lib/transactions/dates';
import { useShortcut } from '../../state/shortcuts';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { Page } from '../../ui/Page';
import { cn } from '../../ui/cn';
import { DeleteConfirm } from '../accounts/DeleteConfirm';
import { formatMoney } from '../../modules/graphs/shared/format';
import { PaycheckEditor } from './PaycheckEditor';
import { usePaychecks } from './usePaychecks';

function schedule(paycheck: Paycheck): string {
  if (paycheck.repeat === 'none')
    return `Once, ${formatDay(paycheck.date)} ${paycheck.date.slice(0, 4)}`;
  const from = `from ${formatDay(paycheck.date)} ${paycheck.date.slice(0, 4)}`;
  const until = paycheck.until
    ? `, until ${formatDay(paycheck.until)} ${paycheck.until.slice(0, 4)}`
    : '';
  return `${REPEAT_LABELS[paycheck.repeat]} ${from}${until}`;
}

function PaycheckCard({
  paycheck,
  accountName,
  selected,
  onSelect,
  onEdit,
}: {
  paycheck: Paycheck;
  accountName: string;
  selected: boolean;
  onSelect(): void;
  onEdit(): void;
}) {
  return (
    <Card
      data-row-id={paycheck.id}
      aria-current={selected || undefined}
      className={cn('cursor-pointer p-4', selected && 'outline-2 outline-offset-2 outline-accent')}
      onClick={onSelect}
      onDoubleClick={onEdit}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{paycheck.name}</h2>
        <p className="text-sm text-muted">{schedule(paycheck)}</p>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted">Gross</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(paycheck.gross)}</dd>
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
      {paycheck.deductions.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {paycheck.deductions.map((d) => (
            <li key={d.id} className="rounded-full border border-line px-2 py-0.5">
              {d.name} <span className="text-muted tabular-nums">{formatMoney(d.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">Paid into {accountName}</p>
    </Card>
  );
}

/** `/paychecks`: what you earn before tax and everything taken out, so the dashboard can follow it. */
export function PaychecksPage() {
  const { list, accounts, save } = usePaychecks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ paycheck: Paycheck; isNew: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const paychecks = list.paychecks;
  const selected = paychecks.find((p) => p.id === selectedId);
  const browsing = !editor && !confirmDelete;
  const accountName = (paycheck: Paycheck, all: Account[]) =>
    (all.find((a) => a.id === paycheck.accountId) ?? all[0])?.name ?? 'your first account';

  useEffect(() => {
    if (!selectedId) return;
    listRef.current
      ?.querySelector(`[data-row-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const persist = async (next: typeof list, then?: () => void) => {
    setError(null);
    try {
      await save(next);
      then?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const startNew = () => setEditor({ paycheck: newPaycheck(paychecks, todayIso()), isNew: true });
  const edit = (paycheck: Paycheck | undefined) =>
    paycheck && setEditor({ paycheck, isNew: false });
  const step = (delta: number) => {
    if (!paychecks.length) return;
    const index = paychecks.findIndex((p) => p.id === selectedId);
    const next = index < 0 ? 0 : Math.max(0, Math.min(paychecks.length - 1, index + delta));
    setSelectedId(paychecks[next]!.id);
  };

  const onSave = (paycheck: Paycheck) => {
    const isNew = editor?.isNew;
    void persist(isNew ? addPaycheck(list, paycheck) : replacePaycheck(list, paycheck), () => {
      setSelectedId(paycheck.id);
      setEditor(null);
    });
  };
  const onDelete = () => {
    if (!selected) return;
    const index = paychecks.findIndex((p) => p.id === selected.id);
    const neighbour = paychecks[index + 1] ?? paychecks[index - 1];
    void persist(removePaycheck(list, selected.id), () => {
      setSelectedId(neighbour?.id ?? null);
      setConfirmDelete(false);
    });
  };

  useShortcut('paychecks.new', startNew, browsing);
  useShortcut('paychecks.down', () => step(1), browsing);
  useShortcut('paychecks.up', () => step(-1), browsing);
  useShortcut('paychecks.edit', () => edit(selected), browsing && !!selected);
  useShortcut('paychecks.delete', () => setConfirmDelete(true), browsing && !!selected);
  useShortcut('paychecks.cancel', () => setConfirmDelete(false), confirmDelete);

  return (
    <Page
      title="Paychecks"
      className="max-w-3xl"
      description={
        <>
          Record what you earn before tax and everything taken out of it. The dashboard can then
          follow your money from gross pay to spending. Stored in the{' '}
          <code className="font-mono">{PAYCHECKS_TAB}</code> tab of your sheet.
        </>
      }
      actions={
        <ActionButton
          shortcut="paychecks.new"
          variant="primary"
          disabled={!browsing}
          onAction={startNew}
        >
          New paycheck
        </ActionButton>
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
            Add one to see where each payment goes: tax, student loan, pension and the rest, then
            into your accounts and what you spend. A paycheck can repeat every week, month or year.
          </p>
        </Card>
      ) : (
        <div ref={listRef} className="flex flex-col gap-3" aria-label="Paychecks">
          {paychecks.map((paycheck) => (
            <div key={paycheck.id}>
              <PaycheckCard
                paycheck={paycheck}
                accountName={accountName(paycheck, accounts)}
                selected={paycheck.id === selectedId}
                onSelect={() => browsing && setSelectedId(paycheck.id)}
                onEdit={() => browsing && edit(paycheck)}
              />
              {confirmDelete && paycheck.id === selectedId && (
                <DeleteConfirm
                  message={`Delete ${paycheck.name}? Past months will no longer show it.`}
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
          key={editor.paycheck.id}
          paycheck={editor.paycheck}
          isNew={editor.isNew}
          accounts={accounts}
          onSave={onSave}
          onCancel={() => setEditor(null)}
        />
      )}
    </Page>
  );
}

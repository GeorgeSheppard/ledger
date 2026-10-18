import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Account } from '../../lib/domain/types';
import {
  netPay,
  newId,
  paycheckProblem,
  REPEAT_LABELS,
  REPEATS,
  tidyPaycheck,
  type Paycheck,
  type Repeat,
} from '../../lib/paychecks/paychecks';
import { useShortcut } from '../../state/shortcuts';
import { ActionButton } from '../../ui/ActionButton';
import { Select } from '../../ui/Select';
import { TextInput } from '../../ui/TextInput';
import { formatMoney } from '../dashboard/format';

/** Amounts are typed as text, so half-typed numbers are not rewritten under the cursor. */
interface Draft extends Omit<Paycheck, 'gross' | 'deductions'> {
  gross: string;
  deductions: { id: string; name: string; amount: string }[];
}

const amountText = (amount: number) => (amount === 0 ? '' : String(amount));

function toDraft(paycheck: Paycheck): Draft {
  return {
    ...paycheck,
    gross: amountText(paycheck.gross),
    deductions: paycheck.deductions.map((d) => ({ ...d, amount: amountText(d.amount) })),
  };
}

/** A typed amount as a number; NaN for text that is not a number, 0 for nothing. */
function parseAmount(text: string): number {
  const cleaned = text.replace(/[,\s]/g, '');
  return cleaned === '' ? 0 : Number(cleaned);
}

function fromDraft(draft: Draft): Paycheck {
  return {
    ...draft,
    gross: parseAmount(draft.gross),
    deductions: draft.deductions.map((d) => ({ ...d, amount: parseAmount(d.amount) })),
  };
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

interface PaycheckEditorProps {
  paycheck: Paycheck;
  isNew: boolean;
  accounts: Account[];
  onSave(paycheck: Paycheck): void;
  onCancel(): void;
}

/** Modal for a paycheck: where it comes from, when it pays, gross pay and every deduction. */
export function PaycheckEditor({
  paycheck,
  isNew,
  accounts,
  onSave,
  onCancel,
}: PaycheckEditorProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() => toDraft(paycheck));
  const [focusedDeduction, setFocusedDeduction] = useState<string | null>(null);
  const [showProblem, setShowProblem] = useState(false);
  const id = useId();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const current = fromDraft(draft);
  const problem = paycheckProblem(current);
  const net = netPay(current);
  const takeHome = Number.isFinite(net) ? net : 0;

  const submit = () => {
    if (problem) {
      setShowProblem(true);
      return;
    }
    onSave(tidyPaycheck(current));
  };

  const addDeduction = () =>
    setDraft((d) => ({
      ...d,
      deductions: [...d.deductions, { id: newId(d.deductions, 'd'), name: '', amount: '' }],
    }));
  const removeDeduction = (deductionId: string | null) => {
    if (!deductionId) return;
    setDraft((d) => ({ ...d, deductions: d.deductions.filter((x) => x.id !== deductionId) }));
    setFocusedDeduction(null);
  };
  const setDeduction = (deductionId: string, patch: Partial<Draft['deductions'][number]>) =>
    setDraft((d) => ({
      ...d,
      deductions: d.deductions.map((x) => (x.id === deductionId ? { ...x, ...patch } : x)),
    }));

  useShortcut('paychecks.addDeduction', addDeduction);
  useShortcut(
    'paychecks.removeDeduction',
    () => removeDeduction(focusedDeduction),
    !!focusedDeduction
  );

  return (
    <dialog
      ref={dialog}
      aria-label={isNew ? 'New paycheck' : 'Edit paycheck'}
      // Escape is handled by the cancel shortcut, so the dialog never closes behind React's back.
      onCancel={(event) => event.preventDefault()}
      className="m-auto max-h-[90dvh] w-[min(560px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-6 text-fg outline-none backdrop:bg-black/40"
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h2 className="text-lg font-semibold">{isNew ? 'New paycheck' : 'Edit paycheck'}</h2>

        <Field
          label="Name"
          htmlFor={`${id}-name`}
          hint="Where the money comes from, e.g. your employer."
        >
          <TextInput
            id={`${id}-name`}
            value={draft.name}
            autoFocus
            placeholder="Salary"
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First payment" htmlFor={`${id}-date`}>
            <TextInput
              id={`${id}-date`}
              type="date"
              value={draft.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </Field>
          <Field label="Repeats" htmlFor={`${id}-repeat`}>
            <Select
              id={`${id}-repeat`}
              value={draft.repeat}
              onChange={(e) => set({ repeat: e.target.value as Repeat })}
            >
              {REPEATS.map((repeat) => (
                <option key={repeat} value={repeat}>
                  {REPEAT_LABELS[repeat]}
                </option>
              ))}
            </Select>
          </Field>
          {draft.repeat !== 'none' && (
            <Field
              label="Last payment"
              htmlFor={`${id}-until`}
              hint="Leave empty if it carries on."
            >
              <TextInput
                id={`${id}-until`}
                type="date"
                value={draft.until ?? ''}
                onChange={(e) => set({ until: e.target.value || null })}
              />
            </Field>
          )}
          <Field label="Paid into" htmlFor={`${id}-account`}>
            <Select
              id={`${id}-account`}
              value={draft.accountId === null ? '' : String(draft.accountId)}
              onChange={(e) =>
                set({ accountId: e.target.value === '' ? null : Number(e.target.value) })
              }
            >
              <option value="">First account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Gross pay (before anything is taken out)" htmlFor={`${id}-gross`}>
          <TextInput
            id={`${id}-gross`}
            inputMode="decimal"
            value={draft.gross}
            placeholder="0.00"
            onChange={(e) => set({ gross: e.target.value })}
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Deductions</legend>
          <p className="text-xs text-muted">
            Anything taken out before the money reaches you: tax, national insurance, student loan,
            pension, and so on. Use whatever names fit your paycheck.
          </p>
          {draft.deductions.map((deduction, i) => (
            <div
              key={deduction.id}
              className="grid grid-cols-[1fr_8rem] gap-2"
              onFocus={() => setFocusedDeduction(deduction.id)}
            >
              <TextInput
                aria-label={`Deduction ${i + 1} name`}
                value={deduction.name}
                placeholder="Income tax"
                onChange={(e) => setDeduction(deduction.id, { name: e.target.value })}
              />
              <TextInput
                aria-label={`Deduction ${i + 1} amount`}
                inputMode="decimal"
                value={deduction.amount}
                placeholder="0.00"
                onChange={(e) => setDeduction(deduction.id, { amount: e.target.value })}
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <ActionButton shortcut="paychecks.addDeduction" onAction={addDeduction}>
              Add deduction
            </ActionButton>
            {focusedDeduction && (
              <ActionButton
                shortcut="paychecks.removeDeduction"
                variant="ghost"
                onAction={() => removeDeduction(focusedDeduction)}
              >
                Remove deduction
              </ActionButton>
            )}
          </div>
        </fieldset>

        <p className="flex justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
          <span className="text-muted">Take-home pay</span>
          <span className="font-semibold tabular-nums">{formatMoney(takeHome)}</span>
        </p>

        {showProblem && problem && (
          <p role="alert" className="text-sm text-negative">
            {problem}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <ActionButton shortcut="paychecks.cancel" variant="ghost" onAction={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton shortcut="paychecks.save" variant="primary" onAction={submit}>
            {isNew ? 'Add paycheck' : 'Done'}
          </ActionButton>
        </div>
      </form>
    </dialog>
  );
}

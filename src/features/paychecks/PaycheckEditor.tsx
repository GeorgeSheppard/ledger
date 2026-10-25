import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  netPay,
  newLine,
  paycheckProblem,
  suggestedNames,
  tidyPaycheck,
  totalBenefits,
  totalDeductions,
  totalIncome,
  type LineKind,
  type PaycheckList,
  type Paycheck,
} from '../../lib/paychecks/paychecks';
import { useShortcut } from '../../state/shortcuts';
import { ActionButton } from '../../ui/ActionButton';
import { TextInput } from '../../ui/TextInput';
import { formatMoney } from '../../modules/graphs/shared/format';

/** Amounts are typed as text, so half-typed numbers are not rewritten under the cursor. */
interface DraftLine {
  id: string;
  name: string;
  amount: string;
}
interface Draft {
  date: string;
  income: DraftLine[];
  benefits: DraftLine[];
  deductions: DraftLine[];
}

const amountText = (amount: number) => (amount === 0 ? '' : String(amount));

function toDraft(paycheck: Paycheck): Draft {
  const lines = (list: Paycheck['income']) =>
    list.map((l) => ({ ...l, amount: amountText(l.amount) }));
  return {
    date: paycheck.date,
    income: lines(paycheck.income),
    benefits: lines(paycheck.benefits),
    deductions: lines(paycheck.deductions),
  };
}

/** A typed amount as a number; NaN for text that is not a number, 0 for nothing. */
function parseAmount(text: string): number {
  const cleaned = text.replace(/[,\s]/g, '');
  return cleaned === '' ? 0 : Number(cleaned);
}

function fromDraft(draft: Draft, id: string): Paycheck {
  const lines = (list: DraftLine[]) => list.map((l) => ({ ...l, amount: parseAmount(l.amount) }));
  return {
    id,
    date: draft.date,
    income: lines(draft.income),
    benefits: lines(draft.benefits),
    deductions: lines(draft.deductions),
  };
}

interface Focus {
  kind: LineKind;
  id: string;
}

interface LinesProps {
  legend: string;
  hint: string;
  kind: LineKind;
  lines: DraftLine[];
  placeholder: string;
  suggestions: string[];
  addLabel: string;
  addShortcut: 'paychecks.addIncome' | 'paychecks.addBenefit' | 'paychecks.addDeduction';
  total: number;
  onAdd(): void;
  /** Use a suggested name: fills an empty line, else adds one. */
  onPick(name: string): void;
  onChange(id: string, patch: Partial<DraftLine>): void;
  onFocus(id: string): void;
  focused: string | null;
  onRemove(): void;
}

function Lines({
  legend,
  hint,
  kind,
  lines,
  placeholder,
  suggestions,
  addLabel,
  addShortcut,
  total,
  onAdd,
  onPick,
  onChange,
  onFocus,
  focused,
  onRemove,
}: LinesProps) {
  const listId = useId();
  const unused = suggestions.filter(
    (name) => !lines.some((l) => l.name.trim().toLowerCase() === name.toLowerCase())
  );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 flex w-full justify-between text-sm font-medium">
        <span>{legend}</span>
        <span className="font-normal text-muted tabular-nums">{formatMoney(total)}</span>
      </legend>
      <p className="text-xs text-muted">{hint}</p>
      <datalist id={listId}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {lines.map((line, i) => (
        <div
          key={line.id}
          className="grid grid-cols-[1fr_8rem] gap-2"
          onFocus={() => onFocus(line.id)}
        >
          <TextInput
            aria-label={`${legend} ${i + 1} name`}
            list={listId}
            value={line.name}
            placeholder={placeholder}
            onChange={(e) => onChange(line.id, { name: e.target.value })}
          />
          <TextInput
            aria-label={`${legend} ${i + 1} amount`}
            inputMode="decimal"
            value={line.amount}
            placeholder="0.00"
            onChange={(e) => onChange(line.id, { amount: e.target.value })}
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-2" data-kind={kind}>
        <ActionButton shortcut={addShortcut} onAction={onAdd}>
          {addLabel}
        </ActionButton>
        {focused && (
          <ActionButton shortcut="paychecks.removeLine" variant="ghost" onAction={onRemove}>
            Remove line
          </ActionButton>
        )}
      </div>
      {unused.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          Used before:
          {unused.slice(0, 6).map((name) => (
            <button
              key={name}
              type="button"
              className="cursor-pointer rounded-full border border-line px-2 py-0.5 text-fg hover:bg-canvas"
              onClick={() => onPick(name)}
            >
              {name}
            </button>
          ))}
        </p>
      )}
    </fieldset>
  );
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
  /** Everything already saved, for suggested names. */
  list: PaycheckList;
  onSave(paycheck: Paycheck): void;
  onCancel(): void;
}

/** Modal for one payslip: income lines, deductions and the take-home pay they leave. */
export function PaycheckEditor({ paycheck, isNew, list, onSave, onCancel }: PaycheckEditorProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() => toDraft(paycheck));
  const [focus, setFocus] = useState<Focus | null>(null);
  const [showProblem, setShowProblem] = useState(false);
  const id = useId();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const current = fromDraft(draft, paycheck.id);
  const problem = paycheckProblem(current);
  const net = netPay(current);
  const finite = (n: number) => (Number.isFinite(n) ? n : 0);

  const submit = () => {
    if (problem) {
      setShowProblem(true);
      return;
    }
    onSave(tidyPaycheck(current));
  };

  const addLine = (kind: LineKind) =>
    setDraft((d) => ({ ...d, [kind]: [...d[kind], { ...newLine(d[kind]), amount: '' }] }));
  const setLine = (kind: LineKind, lineId: string, patch: Partial<DraftLine>) =>
    setDraft((d) => ({
      ...d,
      [kind]: d[kind].map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    }));
  const pickName = (kind: LineKind, name: string) =>
    setDraft((d) => {
      const blank = d[kind].find((l) => !l.name.trim() && !l.amount.trim());
      if (blank) return { ...d, [kind]: d[kind].map((l) => (l === blank ? { ...l, name } : l)) };
      return { ...d, [kind]: [...d[kind], { ...newLine(d[kind]), name, amount: '' }] };
    });
  const removeFocused = () => {
    if (!focus) return;
    setDraft((d) => ({ ...d, [focus.kind]: d[focus.kind].filter((l) => l.id !== focus.id) }));
    setFocus(null);
  };

  useShortcut('paychecks.addIncome', () => addLine('income'));
  useShortcut('paychecks.addBenefit', () => addLine('benefits'));
  useShortcut('paychecks.addDeduction', () => addLine('deductions'));
  useShortcut('paychecks.removeLine', removeFocused, !!focus);

  const common = (kind: LineKind) => ({
    kind,
    lines: draft[kind],
    suggestions: suggestedNames(list, kind),
    onAdd: () => addLine(kind),
    onPick: (name: string) => pickName(kind, name),
    onChange: (lineId: string, patch: Partial<DraftLine>) => setLine(kind, lineId, patch),
    onFocus: (lineId: string) => setFocus({ kind, id: lineId }),
    focused: focus?.kind === kind ? focus.id : null,
    onRemove: removeFocused,
  });

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
          label="Date"
          htmlFor={`${id}-date`}
          hint="The day it was paid. The dashboard counts it in that month."
        >
          <TextInput
            id={`${id}-date`}
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          />
        </Field>

        <Lines
          {...common('income')}
          legend="Income"
          hint="Everything paid before anything is taken out. Give an allowance or bonus its own line, as it appears on the payslip."
          placeholder="Salary"
          addLabel="Add income"
          addShortcut="paychecks.addIncome"
          total={finite(totalIncome(current))}
        />

        <Lines
          {...common('benefits')}
          legend="Benefit in kind"
          hint="Taxable benefits you receive but are not paid in cash, such as a company car or health insurance. They count towards gross pay and tax, not take-home pay."
          placeholder="Health insurance"
          addLabel="Add benefit in kind"
          addShortcut="paychecks.addBenefit"
          total={finite(totalBenefits(current))}
        />

        <Lines
          {...common('deductions')}
          legend="Deductions"
          hint="Anything taken out before the money reaches you: income tax, national insurance, pension, student loan, and so on."
          placeholder="Income tax"
          addLabel="Add deduction"
          addShortcut="paychecks.addDeduction"
          total={finite(totalDeductions(current))}
        />

        <p className="flex justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
          <span className="text-muted">Take-home pay</span>
          <span className="font-semibold tabular-nums">{formatMoney(finite(net))}</span>
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

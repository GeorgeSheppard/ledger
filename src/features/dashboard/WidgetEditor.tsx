import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  KIND_LABELS,
  METRIC_LABELS,
  RANGES,
  STAT_METRICS,
  usesCategories,
  WIDGET_KINDS,
  widgetTitle,
  type StatMetric,
  type Widget,
  type WidgetKind,
  type WidgetWidth,
} from '../../lib/dashboard/config';
import type { Account } from '../../lib/domain/types';
import type { DashboardRange } from '../../lib/metrics/dashboard';
import { ActionButton } from '../../ui/ActionButton';
import { Select } from '../../ui/Select';
import { TextInput } from '../../ui/TextInput';

const WIDTH_LABELS: Record<WidgetWidth, string> = {
  1: 'Quarter',
  2: 'Half',
  3: 'Three quarters',
  4: 'Full width',
};

function rangeLabel(range: DashboardRange): string {
  return range === 'all' ? 'All months' : `Last ${range} months`;
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

interface ChoiceListProps<T> {
  legend: string;
  allLabel: string;
  options: { value: T; label: string }[];
  /** Empty means all. */
  chosen: T[];
  onChange(chosen: T[]): void;
}

/** "All" plus one checkbox per option. Ticking every option, or none, is the same as "All". */
function ChoiceList<T extends string | number>({
  legend,
  allLabel,
  options,
  chosen,
  onChange,
}: ChoiceListProps<T>) {
  const all = chosen.length === 0;
  const toggle = (value: T) => {
    const next = chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value];
    onChange(next.length === options.length ? [] : next);
  };
  const box = 'size-4 accent-accent';
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className={box} checked={all} onChange={() => onChange([])} />
        {allLabel}
      </label>
      <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto pl-6">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={box}
              checked={!all && chosen.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface WidgetEditorProps {
  /** The widget being edited, or a fresh one being added. */
  widget: Widget;
  isNew: boolean;
  accounts: Account[];
  categories: string[];
  onSave(widget: Widget): void;
  onCancel(): void;
}

/** Modal for choosing what a graph shows: its type, accounts, categories, range and size. */
export function WidgetEditor({
  widget,
  isNew,
  accounts,
  categories,
  onSave,
  onCancel,
}: WidgetEditorProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(widget);
  const id = useId();
  const set = (patch: Partial<Widget>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label={isNew ? 'Add a graph' : 'Edit graph'}
      // Escape is handled by the cancel shortcut, so the dialog never closes behind React's back.
      onCancel={(event) => event.preventDefault()}
      className="m-auto max-h-[85dvh] w-[min(520px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-6 text-fg outline-none backdrop:bg-black/40"
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <h2 className="text-lg font-semibold">{isNew ? 'Add a graph' : 'Edit graph'}</h2>

        <Field label="Show" htmlFor={`${id}-kind`}>
          <Select
            id={`${id}-kind`}
            value={draft.kind}
            onChange={(e) => set({ kind: e.target.value as WidgetKind })}
          >
            {WIDGET_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        </Field>

        {draft.kind === 'stat' && (
          <Field label="Number" htmlFor={`${id}-metric`}>
            <Select
              id={`${id}-metric`}
              value={draft.metric}
              onChange={(e) => set({ metric: e.target.value as StatMetric })}
            >
              {STAT_METRICS.map((metric) => (
                <option key={metric} value={metric}>
                  {METRIC_LABELS[metric]}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Title" htmlFor={`${id}-title`}>
          <TextInput
            id={`${id}-title`}
            value={draft.title}
            placeholder={widgetTitle({ ...draft, title: '' })}
            onChange={(e) => set({ title: e.target.value })}
          />
        </Field>

        <ChoiceList
          legend="Accounts"
          allLabel="All accounts"
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          chosen={draft.accounts.filter((a) => accounts.some((account) => account.id === a))}
          onChange={(chosen) => set({ accounts: chosen })}
        />

        {usesCategories(draft.kind) && categories.length > 0 && (
          <ChoiceList
            legend="Categories"
            allLabel="All categories"
            options={categories.map((c) => ({ value: c, label: c }))}
            chosen={draft.categories}
            onChange={(chosen) => set({ categories: chosen })}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Time range" htmlFor={`${id}-range`}>
            <Select
              id={`${id}-range`}
              value={draft.range === null ? '' : String(draft.range)}
              onChange={(e) =>
                set({
                  range:
                    e.target.value === ''
                      ? null
                      : e.target.value === 'all'
                        ? 'all'
                        : Number(e.target.value),
                })
              }
            >
              <option value="">Same as the dashboard</option>
              {RANGES.map((range) => (
                <option key={range} value={String(range)}>
                  {rangeLabel(range)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Width" htmlFor={`${id}-width`}>
            <Select
              id={`${id}-width`}
              value={draft.width}
              onChange={(e) => set({ width: Number(e.target.value) as WidgetWidth })}
            >
              {([1, 2, 3, 4] as const).map((width) => (
                <option key={width} value={width}>
                  {WIDTH_LABELS[width]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <ActionButton shortcut="dashboard.cancel" variant="ghost" onAction={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton shortcut="dashboard.save" variant="primary" onAction={() => onSave(draft)}>
            {isNew ? 'Add graph' : 'Done'}
          </ActionButton>
        </div>
      </form>
    </dialog>
  );
}

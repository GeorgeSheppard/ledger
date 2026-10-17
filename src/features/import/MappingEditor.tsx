import { useRef, type ReactNode } from 'react';
import {
  MAPPED_FIELDS,
  type ColumnMapping,
  type CsvTable,
  type MappedField,
} from '../../lib/csv/mapping';
import { DATE_FORMATS, type DateFormat } from '../../lib/csv/values';
import type { Account } from '../../lib/domain/types';
import { useShortcut } from '../../state/shortcuts';
import { Card } from '../../ui/Card';
import { Kbd } from '../../ui/Kbd';
import { Select } from '../../ui/Select';

interface MappingEditorProps {
  table: CsvTable;
  mapping: ColumnMapping;
  onMappingChange(mapping: ColumnMapping): void;
  onHasHeaderChange(hasHeader: boolean): void;
  accounts: Account[];
  accountId: number | null;
  onAccountChange(accountId: number): void;
}

const NONE = '';

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
      {children}
    </span>
  );
}

/** Account picker plus one dropdown per field, each showing the first row's value as a hint. */
export function MappingEditor({
  table,
  mapping,
  onMappingChange,
  onHasHeaderChange,
  accounts,
  accountId,
  onAccountChange,
}: MappingEditorProps) {
  const accountSelect = useRef<HTMLSelectElement>(null);
  const firstField = useRef<HTMLSelectElement>(null);
  useShortcut('import.account', () => accountSelect.current?.focus());
  useShortcut('import.mapping', () => firstField.current?.focus());
  useShortcut('import.invert', () =>
    onMappingChange({ ...mapping, invertAmounts: !mapping.invertAmounts })
  );

  const sample = table.rows[0] ?? [];
  const setField = (field: MappedField, value: string) => {
    const next = { ...mapping, [field]: value === NONE ? null : Number(value) };
    // A single amount column and split in/out columns are alternatives.
    if (field === 'amount' && value !== NONE) Object.assign(next, { debit: null, credit: null });
    if ((field === 'debit' || field === 'credit') && value !== NONE) next.amount = null;
    onMappingChange(next);
  };

  return (
    <Card className="flex flex-col gap-5 p-5" aria-label="Import settings">
      <label className="flex max-w-xs flex-col gap-1">
        <FieldLabel>
          Import into <Kbd shortcut="import.account" />
        </FieldLabel>
        <Select
          ref={accountSelect}
          value={accountId ?? ''}
          onChange={(e) => onAccountChange(Number(e.target.value))}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Columns</h2>
          <Kbd shortcut="import.mapping" className="text-muted" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          {MAPPED_FIELDS.map(({ field, label }, i) => {
            const index = mapping[field];
            return (
              <label key={field} className="flex min-w-0 flex-col gap-1">
                <FieldLabel>{label}</FieldLabel>
                <Select
                  ref={i === 0 ? firstField : undefined}
                  value={index ?? NONE}
                  onChange={(e) => setField(field, e.target.value)}
                >
                  <option value={NONE}>Not in file</option>
                  {table.headers.map((header, column) => (
                    <option key={column} value={column}>
                      {header}
                    </option>
                  ))}
                </Select>
                <span className="truncate text-xs text-muted tabular-nums">
                  {index === null ? ' ' : sample[index] || 'empty'}
                </span>
              </label>
            );
          })}
          <label className="flex min-w-0 flex-col gap-1">
            <FieldLabel>Date format</FieldLabel>
            <Select
              value={mapping.dateFormat}
              onChange={(e) =>
                onMappingChange({ ...mapping, dateFormat: e.target.value as DateFormat })
              }
            >
              {DATE_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-accent"
            checked={table.hasHeader}
            onChange={(e) => onHasHeaderChange(e.target.checked)}
          />
          First row is a header
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-accent"
            checked={mapping.invertAmounts}
            onChange={(e) => onMappingChange({ ...mapping, invertAmounts: e.target.checked })}
          />
          Spending is positive in this file (flip signs)
          <Kbd shortcut="import.invert" className="text-muted" />
        </label>
      </div>
    </Card>
  );
}

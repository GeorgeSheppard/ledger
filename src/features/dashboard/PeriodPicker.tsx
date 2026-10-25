import { useState } from 'react';
import { monthEnd, monthOf } from '../../lib/metrics/months';
import { periodPresets, samePeriod, shiftPeriod, type Period } from '../../lib/metrics/period';
import { formatDay } from '../../lib/transactions/dates';
import { ActionButton } from '../../ui/ActionButton';
import { cn } from '../../ui/cn';
import { FloatingPanel } from '../../ui/FloatingPanel';
import { TextInput } from '../../ui/TextInput';
import { formatMonthLong } from '../../modules/graphs/shared/format';

interface PeriodPickerProps {
  period: Period;
  today: string;
  /** First day with data, for "All time". */
  first?: string;
  onChange(period: Period): void;
  /** Whether there is an earlier range to return to, and how to return to it. */
  canGoBack: boolean;
  onBack(): void;
}

/** The label for a period: `October 2026` for one whole month, else its first and last day. */
export function periodLabel(period: Period): string {
  const month = monthOf(period.from);
  if (period.from === `${month}-01` && period.to === monthEnd(month)) return formatMonthLong(month);
  const year = (date: string) => date.slice(0, 4);
  return `${formatDay(period.from)} ${year(period.from)} – ${formatDay(period.to)} ${year(period.to)}`;
}

/**
 * The dashboard's date range: step back and forward, pick a preset, or type any two dates. The
 * balances graph can also set it by dragging.
 */
export function PeriodPicker({
  period,
  today,
  first,
  onChange,
  canGoBack,
  onBack,
}: PeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const presets = periodPresets(today, first);
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Dates shown">
      <ActionButton
        shortcut="dashboard.backPeriod"
        variant="ghost"
        aria-label="Back to the previous dates"
        disabled={!canGoBack}
        onAction={onBack}
      >
        ↶ Back
      </ActionButton>
      <ActionButton
        shortcut="dashboard.previousPeriod"
        variant="ghost"
        aria-label="Previous period"
        onAction={() => onChange(shiftPeriod(period, -1))}
      >
        ‹
      </ActionButton>
      <button
        ref={setButton}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Choose dates, now ${periodLabel(period)}`}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={() => setOpen(!open)}
      >
        {periodLabel(period)}
      </button>
      {open && (
        <FloatingPanel
          anchor={button}
          onDismiss={() => setOpen(false)}
          role="dialog"
          aria-label="Choose dates"
          className="w-80 p-3 text-sm"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.nativeEvent.stopPropagation();
            setOpen(false);
            button?.focus();
          }}
          onPlaced={(panel) => panel.querySelector<HTMLElement>('button')?.focus()}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => {
                const on = samePeriod(preset.period, period);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={on}
                    className={cn(
                      'cursor-pointer rounded-full border border-line px-2.5 py-0.5 text-sm transition-colors hover:bg-surface-hover',
                      on && 'border-accent bg-accent/10 ring-2 ring-accent/20'
                    )}
                    onClick={() => {
                      onChange(preset.period);
                      setOpen(false);
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <TextInput
                type="date"
                aria-label="From date"
                value={period.from}
                max={period.to}
                onChange={(e) => e.target.value && onChange({ ...period, from: e.target.value })}
              />
              <span className="text-muted">to</span>
              <TextInput
                type="date"
                aria-label="To date"
                value={period.to}
                min={period.from}
                onChange={(e) => e.target.value && onChange({ ...period, to: e.target.value })}
              />
            </div>
          </div>
        </FloatingPanel>
      )}
      <ActionButton
        shortcut="dashboard.nextPeriod"
        variant="ghost"
        aria-label="Next period"
        onAction={() => onChange(shiftPeriod(period, 1))}
      >
        ›
      </ActionButton>
    </div>
  );
}

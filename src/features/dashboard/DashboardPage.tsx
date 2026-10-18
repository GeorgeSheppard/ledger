import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { filterParams, type LinkedFilters } from '../../lib/transactions/filterParams';
import { paths } from '../../app/paths';
import {
  addWidget,
  moveWidget,
  newWidgetId,
  removeWidget,
  replaceWidget,
  resizeWidget,
  type DashboardConfig,
  type Widget,
  type WidgetWidth,
} from '../../lib/dashboard/config';
import { UNCATEGORISED } from '../../lib/metrics/cashFlow';
import { buildDashboard, type DashboardRange } from '../../lib/metrics/dashboard';
import type { MonthKey } from '../../lib/metrics/months';
import type { ShortcutId } from '../../lib/shortcuts/bindings';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { Page } from '../../ui/Page';
import { FALLBACK_COLOR } from '../../modules/graphs/shared/theme';
import { formatMonthLong } from '../../modules/graphs/shared/format';
import { useDashboardData } from './useDashboardData';
import { WidgetEditor } from './WidgetEditor';
import { createWidget, defaultDashboard, widgetTitle } from '../../modules/graphs';
import { ignoredCategoryNames } from '../../lib/categories/categories';
import { WidgetView } from './WidgetView';

const RANGES: { range: DashboardRange; label: string; shortcut: ShortcutId }[] = [
  { range: 3, label: '3M', shortcut: 'dashboard.range3' },
  { range: 6, label: '6M', shortcut: 'dashboard.range6' },
  { range: 12, label: '12M', shortcut: 'dashboard.range12' },
  { range: 'all', label: 'All', shortcut: 'dashboard.rangeAll' },
];

/** Grid span per widget width: everything stacks on phones, at most 2 across on tablets. */
const SPANS: Record<WidgetWidth, string> = {
  1: 'lg:col-span-1',
  2: 'md:col-span-2 lg:col-span-2',
  3: 'md:col-span-2 lg:col-span-3',
  4: 'md:col-span-2 lg:col-span-4',
};

/** The signed-in homepage: a grid of graphs the user can add, configure and arrange. */
export function DashboardPage() {
  const navigate = useNavigate();
  const { query, layout, saveLayout, paychecks } = useDashboardData();
  const [range, setRange] = useState<DashboardRange>(6);
  const [pickedMonth, setPickedMonth] = useState<MonthKey | null>(null);
  /** The layout being edited; null when not editing. */
  const [draft, setDraft] = useState<DashboardConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ widget: Widget; isNew: boolean } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ledgers = query.data?.ledgers;
  const ignored = useMemo(() => ignoredCategoryNames(query.data?.categories ?? []), [query.data]);
  const overall = useMemo(
    () => (ledgers ? buildDashboard(ledgers, range, undefined, ignored) : null),
    [ledgers, range, ignored]
  );
  const colorOf = useMemo(() => {
    const colors = new Map(query.data?.categories.map((c) => [c.name, c.color]));
    return (category: string) => colors.get(category) ?? FALLBACK_COLOR;
  }, [query.data]);
  const categoryNames = useMemo(() => {
    const names = query.data?.categories.map((c) => c.name) ?? [];
    return names.includes(UNCATEGORISED) ? names : [...names, UNCATEGORISED];
  }, [query.data]);

  if (query.status === 'loading') return <Page title="Dashboard" description="Loading…" />;
  if (query.status === 'error')
    return (
      <Page title="Dashboard">
        <p role="alert" className="text-sm text-negative">
          Could not load your spreadsheet: {query.error.message}
        </p>
      </Page>
    );

  const accounts = query.data.ledgers.map((l) => l.account);
  const editing = draft !== null;
  const config = draft ?? layout;
  const widgets = config.widgets;
  const selectedIndex = widgets.findIndex((w) => w.id === selectedId);
  const selected = selectedIndex >= 0 ? widgets[selectedIndex] : undefined;
  const editorOpen = editor !== null;

  const openTransactions = (accountId: number, filters: LinkedFilters) => {
    const query = filterParams(filters);
    navigate(`${paths.account(accountId)}${query ? `?${query}` : ''}`);
  };
  const startEditing = () => {
    setDraft(layout);
    setSelectedId(layout.widgets[0]?.id ?? null);
    setSaveError(null);
  };
  const change = (next: DashboardConfig) => setDraft(next);
  const openNew = () => {
    if (!editing) startEditing();
    setEditor({ widget: createWidget('netWorth', newWidgetId(config.widgets)), isNew: true });
  };
  const closeEditor = (widget?: Widget) => {
    if (widget && editor) {
      const base = draft ?? layout;
      change(editor.isNew ? addWidget(base, widget) : replaceWidget(base, widget));
      setSelectedId(widget.id);
    }
    setEditor(null);
  };
  const select = (by: number) => {
    if (!widgets.length) return;
    const from = selectedIndex < 0 ? (by > 0 ? -1 : widgets.length) : selectedIndex;
    setSelectedId(widgets[Math.max(0, Math.min(widgets.length - 1, from + by))]!.id);
  };
  const remove = () => {
    if (!selected) return;
    const next = removeWidget(config, selected.id);
    change(next);
    setSelectedId(next.widgets[Math.min(selectedIndex, next.widgets.length - 1)]?.id ?? null);
  };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveLayout(draft);
      setDraft(null);
      setSelectedId(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const description = overall
    ? `${formatMonthLong(overall.months[0]!)} to ${formatMonthLong(overall.latest.month)}`
    : undefined;

  const actions = editing ? (
    <>
      <ActionButton shortcut="dashboard.addWidget" disabled={editorOpen} onAction={openNew}>
        Add graph
      </ActionButton>
      <ActionButton
        shortcut="dashboard.resetLayout"
        variant="ghost"
        disabled={editorOpen}
        onAction={() => change(defaultDashboard())}
      >
        Reset to default
      </ActionButton>
      <ActionButton
        shortcut="dashboard.cancel"
        variant="ghost"
        disabled={editorOpen || saving}
        onAction={() => {
          setDraft(null);
          setSelectedId(null);
        }}
      >
        Cancel
      </ActionButton>
      <ActionButton
        shortcut="dashboard.save"
        variant="primary"
        disabled={editorOpen || saving}
        onAction={save}
      >
        {saving ? 'Saving…' : 'Save layout'}
      </ActionButton>
    </>
  ) : (
    <>
      <div className="flex gap-1" role="group" aria-label="Time range">
        {RANGES.map((option) => (
          <ActionButton
            key={option.label}
            shortcut={option.shortcut}
            variant={option.range === range ? 'primary' : 'ghost'}
            aria-pressed={option.range === range}
            onAction={() => setRange(option.range)}
          >
            {option.label}
          </ActionButton>
        ))}
      </div>
      <ActionButton shortcut="dashboard.edit" onAction={startEditing}>
        Edit layout
      </ActionButton>
    </>
  );

  return (
    <Page title="Dashboard" description={description} actions={actions}>
      {editing && (
        <Card
          className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 p-3 shadow-sm"
          role="toolbar"
          aria-label="Selected graph"
        >
          <span className="px-1 text-sm">
            {selected ? (
              <>
                <span className="text-muted">Selected:</span>{' '}
                <span className="font-medium">{widgetTitle(selected)}</span>
              </>
            ) : (
              <span className="text-muted">Click a graph to select it.</span>
            )}
          </span>
          <div className="flex flex-wrap gap-1">
            <SelectionButtons
              disabled={editorOpen}
              hasWidgets={widgets.length > 0}
              onSelect={select}
            />
            {selected && (
              <>
                <ActionButton
                  shortcut="dashboard.editWidget"
                  variant="ghost"
                  disabled={editorOpen}
                  onAction={() => setEditor({ widget: selected, isNew: false })}
                >
                  Edit
                </ActionButton>
                <ActionButton
                  shortcut="dashboard.moveEarlier"
                  variant="ghost"
                  disabled={editorOpen || selectedIndex === 0}
                  onAction={() => change(moveWidget(config, selected.id, -1))}
                >
                  Earlier
                </ActionButton>
                <ActionButton
                  shortcut="dashboard.moveLater"
                  variant="ghost"
                  disabled={editorOpen || selectedIndex === widgets.length - 1}
                  onAction={() => change(moveWidget(config, selected.id, 1))}
                >
                  Later
                </ActionButton>
                <ActionButton
                  shortcut="dashboard.narrower"
                  variant="ghost"
                  disabled={editorOpen || selected.width === 1}
                  onAction={() => change(resizeWidget(config, selected.id, -1))}
                >
                  Narrower
                </ActionButton>
                <ActionButton
                  shortcut="dashboard.wider"
                  variant="ghost"
                  disabled={editorOpen || selected.width === 4}
                  onAction={() => change(resizeWidget(config, selected.id, 1))}
                >
                  Wider
                </ActionButton>
                <ActionButton
                  shortcut="dashboard.removeWidget"
                  variant="danger"
                  disabled={editorOpen}
                  onAction={remove}
                >
                  Remove
                </ActionButton>
              </>
            )}
          </div>
          {saveError && (
            <p role="alert" className="w-full px-1 text-sm text-negative">
              Could not save the layout: {saveError}
            </p>
          )}
        </Card>
      )}

      {!overall && (
        <Card className="p-6 text-sm text-muted">
          <p>No transactions yet. Add some to an account to see your graphs.</p>
          <p className="mt-2">
            <Link to={paths.accounts}>Go to accounts</Link>
          </p>
        </Card>
      )}

      {overall && widgets.length === 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm text-muted">
          <p>Your dashboard has no graphs. Add one to choose what to see.</p>
          {!editing && (
            <ActionButton shortcut="dashboard.addWidget" variant="primary" onAction={openNew}>
              Add graph
            </ActionButton>
          )}
        </Card>
      )}

      {overall && widgets.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {widgets.map((widget) => {
            const isSelected = editing && widget.id === selectedId;
            return (
              <Card
                key={widget.id}
                className={cn(
                  'min-w-0 p-5',
                  SPANS[widget.width],
                  widget.kind === 'stat' && 'self-start',
                  editing && 'cursor-pointer',
                  isSelected && 'outline-2 outline-offset-2 outline-accent'
                )}
                aria-current={isSelected || undefined}
                onClick={editing ? () => setSelectedId(widget.id) : undefined}
                onDoubleClick={editing ? () => setEditor({ widget, isNew: false }) : undefined}
              >
                <h2
                  className={cn(
                    'mb-3 font-semibold',
                    widget.kind === 'stat' ? 'text-sm font-normal text-muted' : 'text-lg'
                  )}
                >
                  {widgetTitle(widget)}
                </h2>
                <div className={cn(editing && 'pointer-events-none')}>
                  <WidgetView
                    widget={widget}
                    ledgers={query.data.ledgers}
                    paychecks={paychecks}
                    pageRange={range}
                    ignoredCategories={ignored}
                    colorOf={colorOf}
                    selectedMonth={pickedMonth}
                    onSelectMonth={setPickedMonth}
                    interactive={!editing}
                    openTransactions={openTransactions}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editor && (
        <WidgetEditor
          widget={editor.widget}
          isNew={editor.isNew}
          accounts={accounts}
          categories={categoryNames}
          onSave={closeEditor}
          onCancel={() => closeEditor()}
        />
      )}
    </Page>
  );
}

interface SelectionButtonsProps {
  disabled: boolean;
  hasWidgets: boolean;
  onSelect(by: number): void;
}

/** Keyboard selection of graphs; the buttons double as the visible hint for the keys. */
function SelectionButtons({ disabled, hasWidgets, onSelect }: SelectionButtonsProps) {
  return (
    <>
      <ActionButton
        shortcut="dashboard.previousWidget"
        variant="ghost"
        disabled={disabled || !hasWidgets}
        onAction={() => onSelect(-1)}
      >
        Previous
      </ActionButton>
      <ActionButton
        shortcut="dashboard.nextWidget"
        variant="ghost"
        disabled={disabled || !hasWidgets}
        onAction={() => onSelect(1)}
      >
        Next
      </ActionButton>
    </>
  );
}

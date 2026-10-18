import { describe, expect, it } from 'vitest';
import {
  addWidget,
  defaultDashboard,
  moveWidget,
  newWidget,
  newWidgetId,
  removeWidget,
  replaceWidget,
  resizeWidget,
  widgetAccountIds,
  widgetTitle,
} from './config';
import { parseDashboard, serializeDashboard } from './serialize';

const ids = (config: { widgets: { id: string }[] }) => config.widgets.map((w) => w.id);

describe('dashboard config', () => {
  it('has a default layout with unique ids', () => {
    const config = defaultDashboard();
    expect(new Set(ids(config)).size).toBe(config.widgets.length);
    expect(config.widgets.map((w) => w.kind)).toContain('netWorth');
  });

  it('adds, replaces and removes widgets', () => {
    let config = defaultDashboard();
    const id = newWidgetId(config.widgets);
    expect(ids(config)).not.toContain(id);
    config = addWidget(config, newWidget('cashFlow', id));
    expect(ids(config).at(-1)).toBe(id);
    config = replaceWidget(config, { ...config.widgets.at(-1)!, title: 'Mine' });
    expect(config.widgets.at(-1)!.title).toBe('Mine');
    expect(ids(removeWidget(config, id))).not.toContain(id);
  });

  it('moves widgets, stopping at the ends', () => {
    const config = { widgets: ['a', 'b', 'c'].map((id) => newWidget('stat', id)) };
    expect(ids(moveWidget(config, 'a', 1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveWidget(config, 'c', -5))).toEqual(['c', 'a', 'b']);
    expect(ids(moveWidget(config, 'c', 1))).toEqual(['a', 'b', 'c']);
    expect(moveWidget(config, 'x', 1)).toBe(config);
  });

  it('keeps widths between 1 and 4', () => {
    const config = { widgets: [newWidget('netWorth', 'a')] };
    expect(resizeWidget(config, 'a', 5).widgets[0]!.width).toBe(4);
    expect(resizeWidget(config, 'a', -5).widgets[0]!.width).toBe(1);
  });

  it('falls back to every account when the chosen ones are gone', () => {
    const widget = newWidget('netWorth', 'a', { accounts: [1, 9] });
    expect(widgetAccountIds(widget, [1, 2])).toEqual([1]);
    expect(widgetAccountIds({ ...widget, accounts: [9] }, [1, 2])).toEqual([1, 2]);
    expect(widgetAccountIds({ ...widget, accounts: [] }, [1, 2])).toEqual([1, 2]);
  });

  it('titles widgets from their kind unless given one', () => {
    expect(widgetTitle(newWidget('stat', 'a', { metric: 'income' }))).toBe(
      'Income in the latest month'
    );
    expect(widgetTitle(newWidget('balances', 'a', { title: ' Banks ' }))).toBe('Banks');
  });
});

describe('stored dashboard', () => {
  it('round-trips', () => {
    const config = defaultDashboard();
    config.widgets[0] = { ...config.widgets[0]!, accounts: [3], categories: ['Food'], range: 12 };
    const stored = JSON.parse(JSON.stringify(serializeDashboard(config)));
    expect(parseDashboard(stored)).toEqual(config);
  });

  it('is null when missing or unreadable, so the default is used', () => {
    expect(parseDashboard(null)).toBeNull();
    expect(parseDashboard('nonsense')).toBeNull();
    expect(parseDashboard({ widgets: 'x' })).toBeNull();
  });

  it('keeps an empty layout empty', () => {
    expect(parseDashboard({ version: 1, widgets: [] })).toEqual({ widgets: [] });
  });

  it('drops bad widgets and repairs bad fields', () => {
    const parsed = parseDashboard({
      widgets: [
        { id: 'a', kind: 'pie' },
        { kind: 'stat' },
        { id: 'b', kind: 'stat', width: 9, range: 'soon', metric: 'luck', accounts: [1, 'x'] },
        { id: 'b', kind: 'cashFlow' },
      ],
    })!;
    expect(parsed.widgets).toEqual([newWidget('stat', 'b', { width: 4, accounts: [1] })]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  addWidget,
  moveWidget,
  newWidget,
  newWidgetId,
  removeWidget,
  replaceWidget,
  resizeWidget,
  widgetAccountIds,
} from './config';
import { defaultDashboard } from '../../modules/graphs';
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
});

describe('sankey widget', () => {
  it('round-trips through the stored layout', () => {
    const config = { widgets: [newWidget('sankey', 'a', { accounts: [2], range: 3 })] };
    const stored = JSON.parse(JSON.stringify(serializeDashboard(config)));
    expect(parseDashboard(stored)).toEqual(config);
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

  it('keeps a graph kind it does not know, so removing a graph module loses nothing', () => {
    const parsed = parseDashboard({ widgets: [{ id: 'a', kind: 'pie' }] })!;
    expect(parsed.widgets.map((w) => w.kind)).toEqual(['pie']);
  });

  it('drops bad widgets and repairs bad fields', () => {
    const parsed = parseDashboard({
      widgets: [
        { id: 'a', kind: '' },
        { kind: 'stat' },
        { id: 'b', kind: 'stat', width: 9, range: 'soon', metric: 3, accounts: [1, 'x'] },
        { id: 'b', kind: 'cashFlow' },
      ],
    })!;
    expect(parsed.widgets).toEqual([newWidget('stat', 'b', { width: 4, accounts: [1] })]);
  });
});

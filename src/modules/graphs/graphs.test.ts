import { describe, expect, it } from 'vitest';
import { createWidget, defaultDashboard, graphOf, GRAPHS, widgetTitle } from '.';

describe('graph registry', () => {
  it('has one graph per kind', () => {
    const kinds = GRAPHS.map((g) => g.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toContain('sankey');
  });

  it('builds the default layout from registered graphs only', () => {
    const { widgets } = defaultDashboard();
    expect(new Set(widgets.map((w) => w.id)).size).toBe(widgets.length);
    for (const widget of widgets) expect(graphOf(widget.kind)).toBeDefined();
  });

  it('titles widgets from their graph unless given one', () => {
    expect(widgetTitle(createWidget('stat', 'a', { metric: 'income' }))).toBe(
      'Income in the latest month'
    );
    expect(widgetTitle(createWidget('balances', 'a', { title: ' Banks ' }))).toBe('Banks');
    expect(widgetTitle(createWidget('pie', 'a'))).toBe('Unknown graph');
  });

  it('starts widgets at their graph’s width and settings', () => {
    const sankey = createWidget('sankey', 'a');
    expect(sankey.width).toBe(4);
    expect(widgetTitle(sankey)).toBe('Where your money goes');
    expect(createWidget('stat', 'a').metric).toBe('netWorth');
  });
});

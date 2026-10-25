import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./global.css', import.meta.url), 'utf8');

function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--ledger-([a-z-]+): (#[0-9a-f]{6})/g)].map((m) => [m[1]!, m[2]!])
  );
}

const darkStart = css.indexOf('prefers-color-scheme: dark');
const themes = {
  light: tokens(css.slice(0, darkStart)),
  dark: tokens(css.slice(darkStart, css.indexOf('}', css.indexOf('}', darkStart) + 1))),
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe.each(Object.entries(themes))('%s theme contrast', (_name, t) => {
  it('has every token', () => {
    expect(Object.keys(t)).toHaveLength(17);
  });

  it.each([
    ['fg', 'surface'],
    ['fg', 'canvas'],
    ['muted', 'surface'],
    ['muted', 'canvas'],
    ['muted', 'surface-hover'],
    ['accent', 'surface'],
    ['accent', 'canvas'],
    ['positive', 'surface'],
    ['negative', 'surface'],
    ['accent-fg', 'accent'],
    ['accent-fg', 'accent-hover'],
    ['bar-fg', 'bar'],
    ['tile-fg', 'tile-positive'],
    ['tile-fg', 'tile-negative'],
  ])('%s on %s meets WCAG AA for text (4.5:1)', (fg, bg) => {
    expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps surfaces and borders visibly apart', () => {
    expect(ratio(t.surface!, t.canvas!)).toBeGreaterThanOrEqual(1.05);
    expect(ratio(t.line!, t.surface!)).toBeGreaterThanOrEqual(1.4);
    expect(ratio(t['surface-hover']!, t.surface!)).toBeGreaterThanOrEqual(1.05);
  });

  it('draws the framing rule at the 3:1 WCAG asks of controls and boundaries', () => {
    expect(ratio(t.rule!, t.surface!)).toBeGreaterThanOrEqual(3);
    expect(ratio(t.rule!, t.canvas!)).toBeGreaterThanOrEqual(3);
  });
});

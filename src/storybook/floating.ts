import { expect, waitFor } from 'storybook/test';

/**
 * Fails when a floating panel is clipped or covered. Looks up what the browser actually paints at
 * several points inside the panel's box and requires each to be the panel (or inside it), so text
 * from a later table row, a sticky header or a parent's `overflow: hidden` showing through is
 * caught. The panel must also lie inside the viewport. Needs a real browser (stories, not jsdom).
 */
export async function expectOnTop(panel: HTMLElement) {
  await waitFor(() => expect(getComputedStyle(panel).visibility).toBe('visible'));
  const rect = panel.getBoundingClientRect();
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.height).toBeGreaterThan(0);
  expect(rect.left).toBeGreaterThanOrEqual(0);
  expect(rect.top).toBeGreaterThanOrEqual(0);
  expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
  expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
  expect(panel.closest('[data-floating]')).not.toBeNull();
  for (const [fx, fy] of [
    [0.5, 0.5],
    [0.1, 0.1],
    [0.9, 0.1],
    [0.1, 0.9],
    [0.9, 0.9],
  ] as const) {
    const x = rect.left + rect.width * fx;
    const y = rect.top + rect.height * fy;
    const hit = document.elementFromPoint(x, y);
    expect(
      hit && panel.contains(hit),
      `${panel.getAttribute('role') ?? 'panel'} is covered at ${Math.round(x)},${Math.round(y)} by ${hit?.tagName.toLowerCase()} "${hit?.textContent?.slice(0, 30)}"`
    ).toBe(true);
  }
}

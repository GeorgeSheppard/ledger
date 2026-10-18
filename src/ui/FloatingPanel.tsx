import {
  autoUpdate,
  flip,
  hide,
  offset,
  shift,
  size,
  useFloating,
  type Placement,
} from '@floating-ui/react-dom';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

/**
 * Marks every floating panel, so code that reacts to clicks elsewhere on the page (a row editor
 * that saves when you click away) can tell a click inside a panel from a click outside.
 */
export const FLOATING_SELECTOR = '[data-floating]';

interface FloatingPanelProps extends Omit<ComponentProps<'div'>, 'style'> {
  /** The element the panel hangs off. Pass it from state (`ref={setAnchor}`), not a ref object. */
  anchor: HTMLElement | null;
  onDismiss(): void;
  placement?: Placement;
  /** Makes the panel at least as wide as the anchor. */
  matchWidth?: boolean;
  /**
   * Any CSS length. The panel is also capped to the room left in the viewport, and scrolls inside
   * itself when its content is taller.
   */
  maxHeight?: string;
  /**
   * Close when anything outside the panel scrolls (the default), which suits click-opened panels.
   * Turn it off for a panel that opens on focus, where the browser scrolls the field into view
   * right after; it then follows the anchor and hides when the anchor leaves the viewport.
   */
  dismissOnScroll?: boolean;
  /** Called once the panel is in place and visible; the moment to move focus into it. */
  onPlaced?(panel: HTMLDivElement): void;
}

/**
 * The one way to show something floating next to an element: a menu, a filter panel, a dropdown
 * list. Every such panel must use it so they all behave the same:
 *
 * - It is portaled to `<body>` (or into the open `<dialog>` that holds the anchor, because a modal
 *   dialog sits in the browser's top layer and nothing outside it can paint over it). A parent's
 *   `overflow`, `transform` or stacking context therefore cannot clip it or let a later row paint
 *   over it. This is the bug that used to hit the row menu and the category list.
 * - It is positioned with Floating UI: below the anchor, flipped above when there is no room,
 *   nudged to stay on screen (also on phones) and capped to the available height.
 * - It closes (through `onDismiss`) on a pointer press outside it and outside the anchor, on
 *   scroll elsewhere, and when the window width changes. Escape and arrow keys are up to the
 *   caller, since they differ between a menu and a dialog-like panel.
 *
 * The panel is above everything that is not in a top layer (`z-50`). Nothing else in the app
 * should use a z-index above `z-10`. Render it only while open: `{open && <FloatingPanel … />}`.
 */
export function FloatingPanel({
  anchor,
  onDismiss,
  placement = 'bottom-start',
  matchWidth,
  maxHeight,
  dismissOnScroll = true,
  onPlaced,
  className,
  children,
  ...rest
}: FloatingPanelProps) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const { floatingStyles, isPositioned, middlewareData } = useFloating({
    strategy: 'fixed',
    placement,
    elements: { reference: anchor, floating: panel },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8, fallbackAxisSideDirection: 'end' }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, rects, elements }) {
          elements.floating.style.setProperty(
            '--floating-avail',
            `${Math.max(120, availableHeight)}px`
          );
          if (matchWidth) elements.floating.style.minWidth = `${rects.reference.width}px`;
        },
      }),
      hide(),
    ],
  });

  useEffect(() => {
    if (!anchor) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchor.contains(target) && !panel?.contains(target)) onDismiss();
    };
    const scrolled = (event: Event) => {
      if (!panel?.contains(event.target as Node)) onDismiss();
    };
    // Only a width change moves things sideways; a height change (e.g. the mobile address bar or
    // on-screen keyboard) is handled by autoUpdate.
    const width = window.innerWidth;
    const resized = () => {
      if (window.innerWidth !== width) onDismiss();
    };
    document.addEventListener('pointerdown', away);
    if (dismissOnScroll) window.addEventListener('scroll', scrolled, true);
    window.addEventListener('resize', resized);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('scroll', scrolled, true);
      window.removeEventListener('resize', resized);
    };
  }, [anchor, panel, onDismiss, dismissOnScroll]);

  const visible = isPositioned && !middlewareData.hide?.referenceHidden;
  const placed = useRef(onPlaced);
  useEffect(() => {
    placed.current = onPlaced;
  });
  useEffect(() => {
    if (visible && panel) placed.current?.(panel);
  }, [visible, panel]);

  if (!anchor) return null;
  return createPortal(
    <div
      {...rest}
      ref={setPanel}
      data-floating=""
      className={cn(
        'z-50 w-max max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-line bg-surface shadow-lg',
        className
      )}
      style={{
        ...floatingStyles,
        maxHeight: `min(var(--floating-avail), ${maxHeight ?? '100vh'})`,
        visibility: visible ? undefined : 'hidden',
      }}
    >
      {children}
    </div>,
    anchor.closest('dialog') ?? document.body
  );
}

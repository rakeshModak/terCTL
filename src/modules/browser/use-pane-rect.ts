import { useEffect, useRef, type RefObject } from 'react';
import type { PaneRectType } from '@/types/browser';

/**
 * Report an element's box whenever it moves or resizes.
 *
 * The webview behind a browser pane is positioned by us rather than by CSS, so
 * it has to be told where its placeholder ended up. A ResizeObserver only sees
 * size — panes also *slide*, on a 0.18s transition — so this measures on every
 * animation frame instead. That is cheap for a single element, only calls back
 * when the box actually changes, and rAF already stops while the window is
 * hidden.
 *
 * `null` means the pane has no box to occupy: another tab, another route, or
 * simply not rendered.
 */
export function usePaneRect(
  ref: RefObject<HTMLElement | null>,
  onChange: (rect: PaneRectType | null) => void,
) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let frame = 0;
    let previous = '';

    const measure = () => {
      frame = requestAnimationFrame(measure);

      const box = ref.current?.getBoundingClientRect();
      // Rounded before comparing: sub-pixel jitter would otherwise repaint the
      // webview every frame for no visible gain.
      const rect: PaneRectType | null =
        box && box.width > 0 && box.height > 0
          ? {
              x: Math.round(box.left),
              y: Math.round(box.top),
              width: Math.round(box.width),
              height: Math.round(box.height),
            }
          : null;

      const key = rect
        ? `${rect.x},${rect.y},${rect.width},${rect.height}`
        : 'none';
      if (key === previous) return;
      previous = key;
      latest.current(rect);
    };

    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [ref]);
}

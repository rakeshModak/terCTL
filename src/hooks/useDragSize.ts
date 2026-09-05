import type { PointerEvent as ReactPointerEvent } from 'react';

interface DragSizeOptions {
  axis: 'x' | 'y';
  size: number;
  onResize: (size: number) => void;
  min: number;
  max: () => number;
  reverse?: boolean;
}

export function useDragSize({
  axis,
  size,
  onResize,
  min,
  max,
  reverse,
}: DragSizeOptions) {
  return (e: ReactPointerEvent) => {
    e.preventDefault();
    const start = axis === 'x' ? e.clientX : e.clientY;
    const startSize = size;
    const limit = Math.max(min, max());

    const onMove = (ev: PointerEvent) => {
      const now = axis === 'x' ? ev.clientX : ev.clientY;
      const delta = reverse ? start - now : now - start;
      onResize(Math.min(limit, Math.max(min, startSize + delta)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };
}

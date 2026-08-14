import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';
import { useSetAtom } from 'jotai';
import { paneRects, type DividerInfo, type Pane } from '@/lib/layout';
import { setRatioAtom } from '@/store/app';

export interface SessionLayout {
  areaRef: RefObject<HTMLDivElement | null>;
  resizing: boolean;
  rectBySession: Map<
    string,
    { left: number; top: number; width: number; height: number }
  >;
  startDivider: (divider: DividerInfo) => (e: ReactMouseEvent) => void;
}

export function useSessionLayout(layout: Pane | null): SessionLayout {
  const setRatio = useSetAtom(setRatioAtom);
  const areaRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const rectBySession = new Map(
    paneRects(layout).map((r) => [r.sessionId, r.rect]),
  );

  const startDivider = (d: DividerInfo) => (e: ReactMouseEvent) => {
    e.preventDefault();
    setResizing(true);

    const onMove = (ev: globalThis.MouseEvent) => {
      const area = areaRef.current;
      if (!area) return;
      const r = area.getBoundingClientRect();
      if (d.dir === 'row') {
        const pct = ((ev.clientX - r.left) / r.width) * 100;
        setRatio(d.path, (pct - d.parent.left) / d.parent.width);
      } else {
        const pct = ((ev.clientY - r.top) / r.height) * 100;
        setRatio(d.path, (pct - d.parent.top) / d.parent.height);
      }
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return { areaRef, resizing, rectBySession, startDivider };
}

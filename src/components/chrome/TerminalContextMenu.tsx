import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { contextMenuOpenAtom } from '../../store/app';

export interface ContextMenuItem {
  label: string;
  /** Rendered right-aligned and dimmed; purely informational. */
  shortcut?: string;
  disabled?: boolean;
  /** Draws a hairline above this item. */
  separatorBefore?: boolean;
  onSelect: () => void;
}

interface TerminalContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const EDGE_GAP = 6;

export function TerminalContextMenu({
  x,
  y,
  items,
  onClose,
}: TerminalContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [activeIndex, setActiveIndex] = useState(-1);
  const setMenuOpen = useSetAtom(contextMenuOpenAtom);

  // A browser pane's webview is native and would paint straight over this
  // menu, so it is asked to stand down for as long as the menu is up.
  useEffect(() => {
    setMenuOpen(true);
    return () => setMenuOpen(false);
  }, [setMenuOpen]);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const maxLeft = window.innerWidth - el.offsetWidth - EDGE_GAP;
    const maxTop = window.innerHeight - el.offsetHeight - EDGE_GAP;
    setPos({
      left: Math.max(EDGE_GAP, Math.min(x, maxLeft)),
      top: Math.max(EDGE_GAP, Math.min(y, maxTop)),
    });
    el.focus({ preventScroll: true });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    const onWindowChange = () => onClose();
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('blur', onWindowChange);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('blur', onWindowChange);
    };
  }, [onClose]);

  const step = (from: number, delta: number): number => {
    for (let i = 1; i <= items.length; i++) {
      const next = (from + delta * i + items.length * i) % items.length;
      if (!items[next].disabled) return next;
    }
    return -1;
  };

  const run = (item: ContextMenuItem) => {
    if (item.disabled) return;
    onClose();
    item.onSelect();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-label="Terminal actions"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((i) => step(i, 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((i) => step(i < 0 ? 0 : i, -1));
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (activeIndex >= 0) run(items[activeIndex]);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="border-foreground/10 fixed z-50 min-w-52 origin-top-left rounded-lg border bg-(--bg-card) py-1 shadow-[0_10px_34px_rgb(0_0_0/0.5)] outline-none"
      style={{
        left: pos.left,
        top: pos.top,
        animation: 'menuPop 0.12s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {items.map((item, i) => (
        <div key={item.label}>
          {item.separatorBefore && (
            <div className="bg-foreground/10 my-1 h-px" />
          )}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onMouseEnter={() => !item.disabled && setActiveIndex(i)}
            onClick={() => run(item)}
            className={`flex w-full items-center gap-6 px-2.5 py-1 text-left text-xs transition-colors ${
              item.disabled
                ? 'cursor-default text-(--text-faintest)'
                : `cursor-pointer text-(--text) ${
                    activeIndex === i ? 'bg-foreground/10' : ''
                  }`
            }`}
          >
            <span className="flex-1 whitespace-nowrap">{item.label}</span>
            {item.shortcut && (
              <span className="text-2xs shrink-0 font-mono text-(--text-faint)">
                {item.shortcut}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

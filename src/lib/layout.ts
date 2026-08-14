// A recursive split layout for terminal panes (VSCode / Termius style).
// Leaves reference a sessionId; splits divide space row (side-by-side) or
// col (stacked) by a ratio. Terminals are positioned by computed rects so
// they never unmount when the layout changes.

export type Rect = { left: number; top: number; width: number; height: number };

export type Pane =
  | { kind: 'leaf'; sessionId: string }
  | { kind: 'split'; dir: 'row' | 'col'; a: Pane; b: Pane; ratio: number };

export type Edge = 'left' | 'right' | 'top' | 'bottom';

export function leaf(sessionId: string): Pane {
  return { kind: 'leaf', sessionId };
}

export function paneSessionIds(pane: Pane | null): string[] {
  if (!pane) return [];
  if (pane.kind === 'leaf') return [pane.sessionId];
  return [...paneSessionIds(pane.a), ...paneSessionIds(pane.b)];
}

export function hasSession(pane: Pane | null, sessionId: string): boolean {
  return paneSessionIds(pane).includes(sessionId);
}

export function firstLeaf(pane: Pane | null): string | null {
  return paneSessionIds(pane)[0] ?? null;
}

const ROOT: Rect = { left: 0, top: 0, width: 100, height: 100 };

export function paneRects(
  pane: Pane | null,
  rect: Rect = ROOT,
): { sessionId: string; rect: Rect }[] {
  if (!pane) return [];
  if (pane.kind === 'leaf') return [{ sessionId: pane.sessionId, rect }];
  const { dir, ratio, a, b } = pane;
  if (dir === 'row') {
    const wa = rect.width * ratio;
    return [
      ...paneRects(a, { ...rect, width: wa }),
      ...paneRects(b, {
        left: rect.left + wa,
        top: rect.top,
        width: rect.width - wa,
        height: rect.height,
      }),
    ];
  }
  const ha = rect.height * ratio;
  return [
    ...paneRects(a, { ...rect, height: ha }),
    ...paneRects(b, {
      left: rect.left,
      top: rect.top + ha,
      width: rect.width,
      height: rect.height - ha,
    }),
  ];
}

// Remove a leaf and collapse its parent split into the surviving sibling.
export function removeLeaf(pane: Pane | null, sessionId: string): Pane | null {
  if (!pane) return null;
  if (pane.kind === 'leaf') return pane.sessionId === sessionId ? null : pane;
  const a = removeLeaf(pane.a, sessionId);
  const b = removeLeaf(pane.b, sessionId);
  if (a && b) return { ...pane, a, b };
  return a ?? b;
}

// Swap which session a given leaf shows (tab switch inside a pane).
export function replaceLeaf(pane: Pane, oldId: string, newId: string): Pane {
  if (pane.kind === 'leaf')
    return pane.sessionId === oldId ? leaf(newId) : pane;
  return {
    ...pane,
    a: replaceLeaf(pane.a, oldId, newId),
    b: replaceLeaf(pane.b, oldId, newId),
  };
}

export interface DividerInfo {
  path: number[];
  dir: 'row' | 'col';
  ratio: number;
  parent: Rect;
}

// One divider per split node, with the rect it divides (for drag math).
export function paneDividers(
  pane: Pane | null,
  rect: Rect = ROOT,
  path: number[] = [],
): DividerInfo[] {
  if (!pane || pane.kind === 'leaf') return [];
  const { dir, ratio, a, b } = pane;
  const out: DividerInfo[] = [{ path, dir, ratio, parent: rect }];
  if (dir === 'row') {
    const wa = rect.width * ratio;
    out.push(...paneDividers(a, { ...rect, width: wa }, [...path, 0]));
    out.push(
      ...paneDividers(
        b,
        {
          left: rect.left + wa,
          top: rect.top,
          width: rect.width - wa,
          height: rect.height,
        },
        [...path, 1],
      ),
    );
  } else {
    const ha = rect.height * ratio;
    out.push(...paneDividers(a, { ...rect, height: ha }, [...path, 0]));
    out.push(
      ...paneDividers(
        b,
        {
          left: rect.left,
          top: rect.top + ha,
          width: rect.width,
          height: rect.height - ha,
        },
        [...path, 1],
      ),
    );
  }
  return out;
}

export function setRatioAt(pane: Pane, path: number[], ratio: number): Pane {
  if (path.length === 0) {
    return pane.kind === 'split'
      ? { ...pane, ratio: Math.max(0.12, Math.min(0.88, ratio)) }
      : pane;
  }
  if (pane.kind !== 'split') return pane;
  const [head, ...rest] = path;
  return head === 0
    ? { ...pane, a: setRatioAt(pane.a, rest, ratio) }
    : { ...pane, b: setRatioAt(pane.b, rest, ratio) };
}

// Combine two layout trees along an edge (fold one tab's layout into another).
export function mergeTrees(base: Pane, incoming: Pane, edge: Edge): Pane {
  switch (edge) {
    case 'left':
      return { kind: 'split', dir: 'row', a: incoming, b: base, ratio: 0.5 };
    case 'right':
      return { kind: 'split', dir: 'row', a: base, b: incoming, ratio: 0.5 };
    case 'top':
      return { kind: 'split', dir: 'col', a: incoming, b: base, ratio: 0.5 };
    case 'bottom':
      return { kind: 'split', dir: 'col', a: base, b: incoming, ratio: 0.5 };
  }
}

// Split the leaf holding targetId, placing an existing subtree `incoming` at the
// edge (drag one tab's whole layout onto a pane inside another tab).
export function splitTreeAt(
  pane: Pane,
  targetId: string,
  incoming: Pane,
  edge: Edge,
): Pane {
  if (pane.kind === 'leaf') {
    if (pane.sessionId !== targetId) return pane;
    return mergeTrees(pane, incoming, edge);
  }
  return {
    ...pane,
    a: splitTreeAt(pane.a, targetId, incoming, edge),
    b: splitTreeAt(pane.b, targetId, incoming, edge),
  };
}

// Split the leaf holding targetId, placing a new session (leaf) on the edge.
export function splitAt(
  pane: Pane,
  targetId: string,
  draggedId: string,
  edge: Edge,
): Pane {
  return splitTreeAt(pane, targetId, leaf(draggedId), edge);
}

import { atom } from 'jotai'
import type { Getter, Setter } from 'jotai'
import { hostsService } from '../services/hosts.service'
import { sshService } from '../services/ssh.service'
import type { Group, Host } from '../models'
import {
  type Edge,
  type Pane,
  firstLeaf,
  hasSession,
  leaf,
  mergeTrees,
  paneSessionIds,
  removeLeaf,
  replaceLeaf,
  setRatioAt,
  splitTreeAt,
} from '../lib/layout'

export interface Session {
  id: string
  hostId: string // "__local__" for a local shell
  label: string
  status: 'connected' | 'disconnected' | 'reconnecting'
}

// A title-bar tab. A single-host tab has a one-leaf `layout`; a "workspace"
// (label "Deck N") has a split layout holding 2+ sessions. Every tab owns its
// own split tree, so you can build several independent split workspaces.
export interface Tab {
  id: string
  label: string
  layout: Pane
}

// ---- state atoms ----
export const hostsAtom = atom<Host[]>([])
export const groupsAtom = atom<Group[]>([])
export const allTagsAtom = atom<string[]>([])
export const tagFilterAtom = atom<string | null>(null)

export const sessionsAtom = atom<Session[]>([])
export const tabsAtom = atom<Tab[]>([])
export const activeTabIdAtom = atom<string | null>(null)
// The session focused within the active tab (drives the inspector/metrics).
export const activeSessionIdAtom = atom<string | null>(null)

// The tab currently being dragged (for split drop zones).
export const draggingTabIdAtom = atom<string | null>(null)
// The pane (session) being dragged by its header to reposition it WITHIN the
// active tab's Deck.
export const draggingPaneSessionIdAtom = atom<string | null>(null)

export const connectingAtom = atom<{ hostId: string; label: string } | null>(null)
export const connectErrorAtom = atom<{ label: string; message: string } | null>(null)

export const sidebarCollapsedAtom = atom(false)
export const showInspectorAtom = atom(true)

// When true, the sessions view shows the "new tab" chooser (local shell / browse
// hosts) over the terminals instead of jumping straight into a local terminal.
export const newTabPickerAtom = atom(false)
export const setNewTabPickerAtom = atom(null, (_get, set, v: boolean) => {
  set(newTabPickerAtom, v)
})

// ---- simple UI action atoms ----
export const setDraggingPaneAtom = atom(null, (_get, set, sessionId: string | null) => {
  set(draggingPaneSessionIdAtom, sessionId)
})

export const dismissConnectErrorAtom = atom(null, (_get, set) => {
  set(connectErrorAtom, null)
})

export const toggleSidebarAtom = atom(null, (get, set) => {
  set(sidebarCollapsedAtom, !get(sidebarCollapsedAtom))
})

export const toggleInspectorAtom = atom(null, (get, set) => {
  set(showInspectorAtom, !get(showInspectorAtom))
})

export const setTagFilterAtom = atom(null, (get, set, tag: string | null) => {
  set(tagFilterAtom, get(tagFilterAtom) === tag ? null : tag)
})

// ---- drag / Deck actions ----
export const setDraggingTabAtom = atom(null, (get, set, tabId: string | null) => {
  // Dragging the ACTIVE tab: focus its right-else-left neighbor so the
  // neighbor's panes become the drop targets and the dragged (active) tab can
  // fold into it. Non-active drags behave normally.
  if (tabId && tabId === get(activeTabIdAtom)) {
    const tabs = get(tabsAtom)
    const idx = tabs.findIndex((t) => t.id === tabId)
    const neighbor = tabs[idx + 1] ?? tabs[idx - 1]
    if (neighbor) {
      set(draggingTabIdAtom, tabId)
      set(activeTabIdAtom, neighbor.id)
      set(activeSessionIdAtom, firstLeaf(neighbor.layout))
      return
    }
  }
  set(draggingTabIdAtom, tabId)
})

export const repositionPaneAtom = atom(
  null,
  (get, set, draggedSessionId: string, targetSessionId: string, edge: Edge) => {
    if (draggedSessionId === targetSessionId) {
      set(draggingPaneSessionIdAtom, null)
      return
    }
    const tabs = get(tabsAtom)
    const tab = tabs.find((t) => t.id === get(activeTabIdAtom))
    if (
      !tab ||
      !hasSession(tab.layout, draggedSessionId) ||
      !hasSession(tab.layout, targetSessionId)
    ) {
      set(draggingPaneSessionIdAtom, null)
      return
    }
    // Pull the dragged leaf out, then re-insert it at the target's edge.
    const without = removeLeaf(tab.layout, draggedSessionId)
    if (!without) {
      set(draggingPaneSessionIdAtom, null)
      return
    }
    const layout = splitTreeAt(without, targetSessionId, leaf(draggedSessionId), edge)
    set(
      tabsAtom,
      tabs.map((t) => (t.id === tab.id ? { ...t, layout } : t)),
    )
    set(activeSessionIdAtom, draggedSessionId)
    set(draggingPaneSessionIdAtom, null)
  },
)

export const splitWithAtom = atom(null, (get, set, targetSessionId: string, edge: Edge) => {
  const tabs = get(tabsAtom)
  const draggedId = get(draggingTabIdAtom)
  const active = tabs.find((t) => t.id === get(activeTabIdAtom))
  const dragged = tabs.find((t) => t.id === draggedId)
  // Dropping a tab onto its own pane, or an invalid drop, does nothing.
  if (!active || !dragged || dragged.id === active.id) {
    set(draggingTabIdAtom, null)
    return
  }
  const wasWorkspace = paneSessionIds(active.layout).length > 1
  const layout = splitTreeAt(active.layout, targetSessionId, dragged.layout, edge)
  const label = wasWorkspace ? active.label : nextWorkspaceLabel(tabs)
  const next = tabs
    .filter((t) => t.id !== dragged.id)
    .map((t) => (t.id === active.id ? { ...t, layout, label } : t))
  set(tabsAtom, next)
  set(draggingTabIdAtom, null)
})

export const splitActiveTabAtom = atom(null, (get, set) => {
  const tabs = get(tabsAtom)
  const idx = tabs.findIndex((t) => t.id === get(activeTabIdAtom))
  if (idx < 0) return
  const active = tabs[idx]
  // Only a lone host folds into a neighbor; workspaces are grown via drag.
  if (paneSessionIds(active.layout).length > 1) return
  const neighbor = tabs[idx + 1] ?? tabs[idx - 1]
  if (!neighbor) return // lone host, no neighbor → disabled

  const neighborIsWorkspace = paneSessionIds(neighbor.layout).length > 1
  // Host joins the neighbor: neighbor on the left, the split host on the right.
  const layout = mergeTrees(neighbor.layout, active.layout, 'right')
  const label = neighborIsWorkspace ? neighbor.label : nextWorkspaceLabel(tabs)
  const merged: Tab = { id: neighbor.id, label, layout }
  const next = tabs
    .filter((t) => t.id !== active.id)
    .map((t) => (t.id === neighbor.id ? merged : t))
  set(tabsAtom, next)
  set(activeTabIdAtom, neighbor.id)
  set(activeSessionIdAtom, firstLeaf(active.layout))
})

export const setRatioAtom = atom(null, (get, set, path: number[], ratio: number) => {
  const activeTabId = get(activeTabIdAtom)
  set(
    tabsAtom,
    get(tabsAtom).map((t) =>
      t.id === activeTabId ? { ...t, layout: setRatioAt(t.layout, path, ratio) } : t,
    ),
  )
})

// ---- data refresh actions ----
export const refreshHostsAtom = atom(null, async (_get, set) => {
  set(hostsAtom, await hostsService.list())
})

export const refreshGroupsAtom = atom(null, async (_get, set) => {
  set(groupsAtom, await hostsService.listGroups())
})

export const refreshTagsAtom = atom(null, async (_get, set) => {
  set(allTagsAtom, await hostsService.listTags())
})

export const refreshAllAtom = atom(null, async (_get, set) => {
  await Promise.all([
    set(refreshHostsAtom),
    set(refreshGroupsAtom),
    set(refreshTagsAtom),
  ])
})

// ---- session lifecycle actions ----
export const connectAtom = atom(null, async (get, set, host: Host) => {
  set(newTabPickerAtom, false)
  set(connectingAtom, { hostId: host.id, label: host.label })
  set(connectErrorAtom, null)
  try {
    const sessionId = await sshService.connect(host.id)
    addTab(get, set, { id: sessionId, hostId: host.id, label: host.label, status: 'connected' })
    set(connectingAtom, null)
  } catch (e) {
    set(connectingAtom, null)
    set(connectErrorAtom, { label: host.label, message: String(e) })
  }
})

export const openLocalTerminalAtom = atom(null, async (get, set) => {
  set(newTabPickerAtom, false)
  const existing = new Set(get(tabsAtom).map((t) => t.label))
  let n = 1
  while (existing.has(n === 1 ? 'Local' : `Local ${n}`)) n++
  const label = n === 1 ? 'Local' : `Local ${n}`
  try {
    const sessionId = await sshService.localConnect()
    addTab(get, set, { id: sessionId, hostId: '__local__', label, status: 'connected' })
  } catch (e) {
    set(connectErrorAtom, { label, message: String(e) })
  }
})

// Explicit close of a single session (disconnected-banner "Close tab"): tears
// down the backend session and removes its pane; drops the tab if empty.
export const closeSessionAtom = atom(null, (get, set, sessionId: string) => {
  void sshService.disconnect(sessionId)
  set(
    sessionsAtom,
    get(sessionsAtom).filter((s) => s.id !== sessionId),
  )
  const tabs = get(tabsAtom)
    .map((t) => {
      if (!hasSession(t.layout, sessionId)) return t
      const layout = removeLeaf(t.layout, sessionId)
      return layout ? { ...t, layout } : null
    })
    .filter((t): t is Tab => t !== null)
  resolveActive(get, set, tabs, sessionId)
})

// Close a whole tab (its ✕): disconnects every session in it.
export const closeTabAtom = atom(null, (get, set, tabId: string) => {
  const tab = get(tabsAtom).find((t) => t.id === tabId)
  if (!tab) return
  const ids = paneSessionIds(tab.layout)
  ids.forEach((id) => void sshService.disconnect(id))
  set(
    sessionsAtom,
    get(sessionsAtom).filter((s) => !ids.includes(s.id)),
  )
  const tabs = get(tabsAtom).filter((t) => t.id !== tabId)
  resolveActive(get, set, tabs, get(activeSessionIdAtom))
})

export const markDisconnectedAtom = atom(null, (get, set, sessionId: string) => {
  set(
    sessionsAtom,
    get(sessionsAtom).map((s) =>
      s.id === sessionId && s.status === 'connected' ? { ...s, status: 'disconnected' } : s,
    ),
  )
})

export const reconnectAtom = atom(null, async (get, set, sessionId: string) => {
  const session = get(sessionsAtom).find((s) => s.id === sessionId)
  if (!session) return
  set(
    sessionsAtom,
    get(sessionsAtom).map((s) => (s.id === sessionId ? { ...s, status: 'reconnecting' } : s)),
  )
  try {
    const newId =
      session.hostId === '__local__'
        ? await sshService.localConnect()
        : await sshService.connect(session.hostId)
    set(
      sessionsAtom,
      get(sessionsAtom).map((s) =>
        s.id === sessionId ? { ...s, id: newId, status: 'connected' } : s,
      ),
    )
    set(
      tabsAtom,
      get(tabsAtom).map((t) =>
        hasSession(t.layout, sessionId) ? { ...t, layout: replaceLeaf(t.layout, sessionId, newId) } : t,
      ),
    )
    if (get(activeSessionIdAtom) === sessionId) set(activeSessionIdAtom, newId)
  } catch {
    set(
      sessionsAtom,
      get(sessionsAtom).map((s) => (s.id === sessionId ? { ...s, status: 'disconnected' } : s)),
    )
  }
})

export const setActiveTabAtom = atom(null, (get, set, tabId: string) => {
  const tab = get(tabsAtom).find((t) => t.id === tabId)
  if (!tab) return
  set(newTabPickerAtom, false)
  set(activeTabIdAtom, tabId)
  set(activeSessionIdAtom, firstLeaf(tab.layout))
})

export const setActiveSessionAtom = atom(null, (get, set, sessionId: string) => {
  const tab = get(tabsAtom).find((t) => hasSession(t.layout, sessionId))
  if (!tab) {
    set(activeSessionIdAtom, sessionId)
    return
  }
  set(activeTabIdAtom, tab.id)
  set(activeSessionIdAtom, sessionId)
})

// ---- helpers ----

// Returns a label unique among `existing`, appending " (n)" on collision
// (Termius-style): "test" → "test (1)" → "test (2)".
function uniqueLabel(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base
  let n = 1
  while (existing.includes(`${base} (${n})`)) n++
  return `${base} (${n})`
}

function nextWorkspaceLabel(tabs: Tab[]): string {
  const existing = tabs.map((t) => t.label)
  let n = 1
  while (existing.includes(`Deck ${n}`)) n++
  return `Deck ${n}`
}

let tabCounter = 0
function newTabId(): string {
  return `tab-${++tabCounter}`
}

// Add a freshly-opened session as its own new tab and focus it.
function addTab(get: Getter, set: Setter, session: Session): void {
  const tabs = get(tabsAtom)
  const label = uniqueLabel(
    session.label,
    tabs.map((t) => t.label),
  )
  const tab: Tab = { id: newTabId(), label, layout: leaf(session.id) }
  set(sessionsAtom, [...get(sessionsAtom), { ...session, label }])
  set(tabsAtom, [...tabs, tab])
  set(activeTabIdAtom, tab.id)
  set(activeSessionIdAtom, session.id)
}

// After removing sessions/tabs, pick a valid active tab + session and commit
// the new tab list.
function resolveActive(
  get: Getter,
  set: Setter,
  tabs: Tab[],
  removedSessionId: string | null,
): void {
  let activeTabId = get(activeTabIdAtom)
  let activeSessionId = get(activeSessionIdAtom)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  if (!activeTab) {
    const last = tabs[tabs.length - 1] ?? null
    activeTabId = last?.id ?? null
    activeSessionId = last ? firstLeaf(last.layout) : null
  } else if (
    activeSessionId === removedSessionId ||
    !hasSession(activeTab.layout, activeSessionId ?? '')
  ) {
    activeSessionId = firstLeaf(activeTab.layout)
  }
  set(tabsAtom, tabs)
  set(activeTabIdAtom, activeTabId)
  set(activeSessionIdAtom, activeSessionId)
}

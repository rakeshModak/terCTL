import { useRef, type MouseEvent } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useRouterState } from '@tanstack/react-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { TerctlLogo } from './TerctlLogo'
import {
  activeTabIdAtom,
  closeTabAtom,
  sessionsAtom,
  setActiveTabAtom,
  setDraggingTabAtom,
  setNewTabPickerAtom,
  showInspectorAtom,
  splitActiveTabAtom,
  tabsAtom,
  toggleInspectorAtom,
} from '../../store/app'
import { paneSessionIds } from '../../lib/layout'
import { PALETTE_HINT } from '../../lib/platform'

const PATH_LABELS: Record<string, string> = {
  '/sessions': 'Terminal',
  '/hosts': 'Hosts',
  '/transfer': 'Transfer',
  '/keys': 'Keys & Identity',
  '/settings': 'Settings',
}

export function TitleBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const onSessions = pathname === '/sessions'
  const tabs = useAtomValue(tabsAtom)
  const sessions = useAtomValue(sessionsAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const showInspector = useAtomValue(showInspectorAtom)
  const setActiveTab = useSetAtom(setActiveTabAtom)
  const closeTab = useSetAtom(closeTabAtom)
  const setNewTabPicker = useSetAtom(setNewTabPickerAtom)
  const toggleInspector = useSetAtom(toggleInspectorAtom)
  const setDraggingTab = useSetAtom(setDraggingTabAtom)
  const splitActiveTab = useSetAtom(splitActiveTabAtom)

  // Detect double-click ourselves on the second mousedown (within 400ms) and
  // toggle zoom directly — the browser's own dblclick event races with window
  // dragging and fires only intermittently.
  const lastDownRef = useRef(0)
  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return

    const now = Date.now()
    if (now - lastDownRef.current < 400) {
      lastDownRef.current = 0
      void getCurrentWindow().toggleMaximize()
      return
    }
    lastDownRef.current = now

    const startX = e.clientX
    const startY = e.clientY
    const onMove = (ev: globalThis.MouseEvent) => {
      if (Math.abs(ev.clientX - startX) > 6 || Math.abs(ev.clientY - startY) > 6) {
        cleanup()
        void getCurrentWindow().startDragging()
      }
    }
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', cleanup)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', cleanup)
  }

  const showTabs = onSessions && tabs.length > 0

  return (
    <div
      onMouseDown={onMouseDown}
      className="flex h-[46px] shrink-0 items-center gap-[14px] border-b border-[var(--border-2)] bg-[linear-gradient(180deg,#121620,#0c0e13)] pl-[86px] pr-[14px]"
      style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.4)' }}
    >
      <div className="flex shrink-0 items-center gap-[10px]">
        <TerctlLogo size={20} glow={false} />
        <span className="text-[14.5px] font-semibold tracking-[0.3px] text-[var(--text)]">
          Ter<span className="text-[var(--text-dim)]">CTL</span>
        </span>
      </div>

      {showTabs ? (
        <div data-no-drag className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const active = tab.id === activeTabId
            const ids = paneSessionIds(tab.layout)
            const isWorkspace = ids.length > 1
            const allConnected = ids.every(
              (id) => sessions.find((s) => s.id === id)?.status === 'connected',
            )
            return (
              <div
                key={tab.id}
                className={`flex max-w-[190px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-[10px] py-[6px] text-[12.5px] ${active ? 'bg-[var(--accent-soft-2)] text-[var(--text)]' : 'bg-white/[0.03] text-[var(--text-muted)] hover:bg-white/[0.06]'}`}
                style={active ? { borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' } : undefined}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', tab.id)
                  setDraggingTab(tab.id)
                }}
                onDragEnd={() => setDraggingTab(null)}
                onClick={() => setActiveTab(tab.id)}
              >
                {isWorkspace ? (
                  <span className="flex shrink-0 items-center text-[var(--accent)]" title="Deck">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="M12 4v16" />
                    </svg>
                  </span>
                ) : (
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#3ddc97] shadow-[0_0_6px_#3ddc97]"
                    style={allConnected ? undefined : { background: '#ff5f56', boxShadow: '0 0 6px #ff5f56' }}
                  />
                )}
                <span className="overflow-hidden text-ellipsis">{tab.label}</span>
                {active && !isWorkspace && tabs.length > 1 && (
                  <span
                    className="flex shrink-0 items-center text-[var(--text-faint)] hover:text-[var(--accent)]"
                    title="Split with neighbor"
                    onClick={(e) => {
                      e.stopPropagation()
                      splitActiveTab()
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="M12 4v16" />
                    </svg>
                  </span>
                )}
                <span
                  className="shrink-0 text-[11px] text-[var(--text-faint)] hover:text-[var(--red)]"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                >
                  ✕
                </span>
              </div>
            )
          })}
          <button data-no-drag className="h-7 w-7 shrink-0 cursor-pointer rounded-lg bg-white/[0.04] text-base text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]" onClick={() => setNewTabPicker(true)} title="New tab">
            +
          </button>
        </div>
      ) : (
        <span className="text-[12.5px] tracking-[0.2px] text-[var(--text-muted)]">{PATH_LABELS[pathname] ?? ''}</span>
      )}

      <div data-tauri-drag-region className="min-w-[20px] flex-1 self-stretch" />

      {onSessions && tabs.length > 0 && (
        <button
          data-no-drag
          className={`flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg ${showInspector ? 'bg-[var(--accent-soft-2)] text-[var(--accent)]' : 'bg-transparent text-[var(--text-muted)]'}`}
          title="Toggle details panel"
          onClick={toggleInspector}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M15 4v16" />
          </svg>
        </button>
      )}
      <span className="text-[11.5px] text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>{PALETTE_HINT}</span>
    </div>
  )
}

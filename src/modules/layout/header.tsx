import { useRef, type MouseEvent } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useRouterState } from '@tanstack/react-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { Columns2, Minus, PanelRight, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TerctlLogo } from '../../components/chrome/TerctlLogo'
import NewSessionMenu from '../sessions/new-session-menu'
import {
  activeTabIdAtom,
  closeTabAtom,
  sessionsAtom,
  setActiveTabAtom,
  setDraggingTabAtom,
  showInspectorAtom,
  splitActiveTabAtom,
  tabsAtom,
  toggleInspectorAtom,
} from '../../store/app'
import { paneSessionIds } from '../../lib/layout'
import { IS_MAC } from '../../lib/platform'

const PATH_LABELS: Record<string, string> = {
  '/sessions': 'Terminal',
  '/hosts': 'Hosts',
  '/transfer': 'Transfer',
  '/keys': 'Keys & Identity',
  '/settings': 'Settings',
}

const BAR_SURFACE = 'color-mix(in srgb, var(--brand) 4%, var(--sidebar))'

function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const onSessions = pathname === '/sessions'
  const tabs = useAtomValue(tabsAtom)
  const sessions = useAtomValue(sessionsAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const showInspector = useAtomValue(showInspectorAtom)
  const setActiveTab = useSetAtom(setActiveTabAtom)
  const closeTab = useSetAtom(closeTabAtom)
  const toggleInspector = useSetAtom(toggleInspectorAtom)
  const setDraggingTab = useSetAtom(setDraggingTabAtom)
  const splitActiveTab = useSetAtom(splitActiveTabAtom)

  const lastDownRef = useRef(0)
  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    if (!e.currentTarget.contains(e.target as Node)) return

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
      style={{ background: BAR_SURFACE }}
      className={cn(
        'flex h-[46px] shrink-0 items-center gap-3.5 border-b border-border',
        IS_MAC ? 'pr-3.5 pl-[86px]' : 'pr-0 pl-3.5',
      )}
    >
      <div className="flex shrink-0 items-center gap-2.5 text-foreground">
        <TerctlLogo size={20} />
        <span className="text-sm font-semibold tracking-wide text-foreground">
          Ter<span className="text-muted-foreground">CTL</span>
        </span>
      </div>

      {showTabs ? (
        <div
          data-no-drag
          className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
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
                className={cn(
                  'flex max-w-[190px] cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors',
                  active
                    ? 'border-primary/35 bg-primary/12 text-foreground'
                    : 'border-transparent bg-foreground/3 text-muted-foreground hover:bg-foreground/6',
                )}
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
                  <Columns2 className="size-3 shrink-0 text-primary" aria-label="Deck" />
                ) : (
                  <span
                    className={cn(
                      'size-1.75 shrink-0 rounded-full',
                      allConnected ? 'bg-chart-4' : 'bg-destructive',
                    )}
                    style={{
                      boxShadow: `0 0 6px ${allConnected ? 'var(--green)' : 'var(--red)'}`,
                    }}
                  />
                )}
                <span className="overflow-hidden text-ellipsis">{tab.label}</span>
                {active && !isWorkspace && tabs.length > 1 && (
                  <button
                    type="button"
                    className="flex shrink-0 items-center text-muted-foreground hover:text-primary"
                    title="Split with neighbor"
                    onClick={(e) => {
                      e.stopPropagation()
                      splitActiveTab()
                    }}
                  >
                    <Columns2 className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className="flex shrink-0 items-center text-muted-foreground hover:text-destructive"
                  title="Close tab"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                >
                  <X className="size-3" />
                </button>
              </div>
            )
          })}
          {/* Owned by the sessions module — it decides what a new session is. */}
          <NewSessionMenu />
        </div>
      ) : (
        <span className="text-xs tracking-wide text-muted-foreground">
          {PATH_LABELS[pathname] ?? ''}
        </span>
      )}

      <div data-tauri-drag-region className="min-w-5 flex-1 self-stretch" />

      {onSessions && tabs.length > 0 && (
        <button
          data-no-drag
          type="button"
          className={cn(
            'flex size-7.5 shrink-0 items-center justify-center rounded-lg transition-colors',
            showInspector
              ? 'bg-primary/12 text-primary'
              : 'bg-transparent text-muted-foreground hover:text-foreground',
          )}
          title="Toggle details panel"
          onClick={toggleInspector}
        >
          <PanelRight className="size-4" />
        </button>
      )}
      {!IS_MAC && <WindowControls />}
    </div>
  )
}

function WindowControls() {
  const btn =
    'flex h-[46px] w-[46px] items-center justify-center text-muted-foreground transition-colors'
  return (
    <div data-no-drag className="flex self-stretch">
      <button
        type="button"
        className={cn(btn, 'hover:bg-foreground/8 hover:text-foreground')}
        title="Minimize"
        onClick={() => void getCurrentWindow().minimize()}
      >
        <Minus className="size-2.5" />
      </button>
      <button
        type="button"
        className={cn(btn, 'hover:bg-foreground/8 hover:text-foreground')}
        title="Maximize"
        onClick={() => void getCurrentWindow().toggleMaximize()}
      >
        <Square className="size-2.5" />
      </button>
      <button
        type="button"
        className={cn(btn, 'hover:bg-[#e81123] hover:text-white')}
        title="Close"
        onClick={() => void getCurrentWindow().close()}
      >
        <X className="size-2.5" />
      </button>
    </div>
  )
}

export default Header

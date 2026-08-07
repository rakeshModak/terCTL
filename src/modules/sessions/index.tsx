import { useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { Terminal } from './Terminal'
import { MetricsPanel } from './MetricsPanel'
import { TerctlLoader } from '../../components/chrome/TerctlLogo'
import type { Host } from '../../models'
import { paneDividers, paneRects, type DividerInfo, type Edge } from '../../lib/layout'
import {
  activeSessionIdAtom,
  activeTabIdAtom,
  closeSessionAtom,
  connectAtom,
  connectErrorAtom,
  connectingAtom,
  dismissConnectErrorAtom,
  draggingPaneSessionIdAtom,
  draggingTabIdAtom,
  hostsAtom,
  markDisconnectedAtom,
  newTabPickerAtom,
  openLocalTerminalAtom,
  reconnectAtom,
  repositionPaneAtom,
  sessionsAtom,
  setActiveSessionAtom,
  setDraggingPaneAtom,
  setNewTabPickerAtom,
  setRatioAtom,
  showInspectorAtom,
  splitWithAtom,
  tabsAtom,
  toggleInspectorAtom,
} from '../../store/app'

const btnAccent =
  'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] bg-[image:var(--gradient-brand)] px-4 py-[10px] text-[13px] font-bold text-[#1a0e0a]'
const btnGhost =
  'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border border-[var(--border-strong)] bg-foreground/[0.03] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--text-bright)] hover:border-[var(--brand-border)]'
const accentBtnShadow = { boxShadow: '0 4px 16px color-mix(in srgb, var(--brand) 30%, transparent)' } as const
const cardGradient = 'bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))]'
const connectCard = `flex max-w-[420px] flex-col items-center gap-3 rounded-2xl border border-[var(--border-2)] ${cardGradient} px-10 py-8 text-center animate-[rise_0.25s_ease_both]`
const cardShadow = { boxShadow: '0 24px 60px -20px rgba(0,0,0,0.7)' } as const

export function SessionsView() {
  const hosts = useAtomValue(hostsAtom)
  const sessions = useAtomValue(sessionsAtom)
  const tabs = useAtomValue(tabsAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const activeSessionId = useAtomValue(activeSessionIdAtom)
  const draggingTabId = useAtomValue(draggingTabIdAtom)
  const draggingPaneSessionId = useAtomValue(draggingPaneSessionIdAtom)
  const connecting = useAtomValue(connectingAtom)
  const connectError = useAtomValue(connectErrorAtom)
  const showInspector = useAtomValue(showInspectorAtom)
  const newTabPicker = useAtomValue(newTabPickerAtom)

  const setDraggingPane = useSetAtom(setDraggingPaneAtom)
  const repositionPane = useSetAtom(repositionPaneAtom)
  const splitWith = useSetAtom(splitWithAtom)
  const setActiveSession = useSetAtom(setActiveSessionAtom)
  const closeSession = useSetAtom(closeSessionAtom)
  const markDisconnected = useSetAtom(markDisconnectedAtom)
  const reconnect = useSetAtom(reconnectAtom)
  const connect = useSetAtom(connectAtom)
  const openLocalTerminal = useSetAtom(openLocalTerminalAtom)
  const dismissConnectError = useSetAtom(dismissConnectErrorAtom)
  const setNewTabPicker = useSetAtom(setNewTabPickerAtom)
  const toggleInspector = useSetAtom(toggleInspectorAtom)
  const setRatio = useSetAtom(setRatioAtom)
  const navigate = useNavigate()

  const termAreaRef = useRef<HTMLDivElement>(null)
  const [resizing, setResizing] = useState(false)

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const layout = activeTab?.layout ?? null
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const activeHost = activeSession ? hosts.find((h) => h.id === activeSession.hostId) ?? null : null
  const rectBySession = new Map(paneRects(layout).map((r) => [r.sessionId, r.rect]))

  const startDivider = (d: DividerInfo) => (e: ReactMouseEvent) => {
    e.preventDefault()
    setResizing(true)
    const onMove = (ev: globalThis.MouseEvent) => {
      const area = termAreaRef.current
      if (!area) return
      const r = area.getBoundingClientRect()
      if (d.dir === 'row') {
        const pct = ((ev.clientX - r.left) / r.width) * 100
        setRatio(d.path, (pct - d.parent.left) / d.parent.width)
      } else {
        const pct = ((ev.clientY - r.top) / r.height) * 100
        setRatio(d.path, (pct - d.parent.top) / d.parent.height)
      }
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="flex min-w-0 flex-1">
      {/* terminal column — tabs live in the title bar now */}
      <div className="flex min-w-0 flex-1 flex-col bg-[var(--bg)]">
        <div ref={termAreaRef} className={`relative min-h-0 flex-1 ${resizing ? 'select-none' : ''}`}>
          {(tabs.length === 0 || newTabPicker) && !connecting && !connectError && (
            <div className="absolute inset-0 z-[4] flex items-center justify-center bg-[var(--bg)] text-[13px] text-[var(--text-faint)]">
              <div className="flex flex-col items-center gap-[14px]">
                <span>Start a local shell, or open a host from the Hosts view.</span>
                <div className="flex gap-[10px]">
                  <button className={btnAccent} style={accentBtnShadow} onClick={() => openLocalTerminal()}>
                    <span className="text-[15px]">›_</span> New local terminal
                  </button>
                  <button
                    className={btnGhost}
                    onClick={() => {
                      setNewTabPicker(false)
                      navigate({ to: '/hosts' })
                    }}
                  >
                    Browse hosts
                  </button>
                </div>
              </div>
            </div>
          )}
          {connecting && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[var(--bg)]">
              <div className={connectCard} style={cardShadow}>
                <TerctlLoader size={54} glow={false} />
                <div className="text-[15px] font-semibold text-[var(--text)]">Connecting to {connecting.label}</div>
                <div className="text-[12px] text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                  Opening TCP channel · authenticating · requesting shell…
                </div>
              </div>
            </div>
          )}
          {connectError && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[var(--bg)]">
              <div className={`${connectCard} border-[rgb(255_95_86_/_0.35)]`} style={cardShadow}>
                <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[rgb(255_95_86_/_0.12)] text-base font-bold text-[var(--red)]">✕</div>
                <div className="text-[15px] font-semibold text-[var(--text)]">Couldn’t connect to {connectError.label}</div>
                <div className="break-words text-[12px] leading-[1.5] text-[var(--red)]" style={{ fontFamily: 'var(--font-mono)' }}>{connectError.message}</div>
                <button className={btnAccent} style={accentBtnShadow} onClick={() => dismissConnectError()}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {sessions.map((s) => {
            const rect = rectBySession.get(s.id)
            const active = s.id === activeSessionId
            const isSplit = rectBySession.size >= 2
            const showZones =
              !!rect &&
              ((!!draggingTabId && draggingTabId !== activeTabId) ||
                (!!draggingPaneSessionId && draggingPaneSessionId !== s.id))
            const onZoneSplit = (edge: Edge) =>
              draggingPaneSessionId
                ? repositionPane(draggingPaneSessionId, s.id, edge)
                : splitWith(s.id, edge)
            return (
              <div
                key={s.id}
                className="absolute overflow-hidden"
                style={{
                  ...(rect
                    ? {
                        left: `${rect.left}%`,
                        top: `${rect.top}%`,
                        right: `${100 - rect.left - rect.width}%`,
                        bottom: `${100 - rect.top - rect.height}%`,
                      }
                    : { display: 'none' }),
                  transition: resizing ? 'none' : 'inset 0.18s cubic-bezier(0.22,1,0.36,1)',
                }}
                onMouseDown={() => !active && setActiveSession(s.id)}
              >
                {/* Uniform structure (box → bar + term) for every pane so the
                    Terminal never changes tree position — the bar is just hidden
                    when the pane isn't part of a split (no remount = no lost
                    scrollback when splitting/unsplitting). */}
                <div
                  className={`absolute flex flex-col overflow-hidden transition-all duration-150 ${isSplit ? 'inset-[3px] rounded-lg border' : 'inset-0'}`}
                  style={
                    isSplit
                      ? {
                          background: 'var(--term-bg, var(--bg))',
                          borderColor: active ? 'color-mix(in srgb, var(--brand) 55%, transparent)' : 'var(--border)',
                          boxShadow: active
                            ? 'inset 0 0 0 1px color-mix(in srgb, var(--brand) 22%, transparent), 0 0 16px -4px color-mix(in srgb, var(--brand) 40%, transparent)'
                            : undefined,
                        }
                      : undefined
                  }
                >
                  <div
                    className={`h-[26px] shrink-0 cursor-grab select-none items-center gap-[6px] pl-[9px] pr-[5px] text-[11px] active:cursor-grabbing ${active ? 'text-[var(--text-bright)]' : 'text-[var(--text-dim)]'} ${draggingPaneSessionId === s.id ? 'opacity-50' : ''}`}
                    style={{ display: isSplit ? 'flex' : 'none', background: 'var(--term-bg, var(--bg))', fontFamily: 'var(--font-mono)' }}
                    draggable
                    title="Drag to reposition in this Deck"
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', s.id)
                      setDraggingPane(s.id)
                    }}
                    onDragEnd={() => setDraggingPane(null)}
                  >
                    <svg className="shrink-0 text-[var(--text-faint)]" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="8" cy="5" r="1.7" />
                      <circle cx="8" cy="12" r="1.7" />
                      <circle cx="8" cy="19" r="1.7" />
                      <circle cx="16" cy="5" r="1.7" />
                      <circle cx="16" cy="12" r="1.7" />
                      <circle cx="16" cy="19" r="1.7" />
                    </svg>
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">{s.label}</span>
                    <span className="flex-1" />
                    <button
                      className="shrink-0 cursor-pointer rounded-md bg-transparent px-[6px] py-1 text-[11px] leading-none text-[var(--text-faint)] hover:bg-foreground/5 hover:text-[var(--red)]"
                      title="Close this pane"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeSession(s.id)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className={`relative min-h-0 flex-1 ${isSplit && !active ? 'opacity-[0.82]' : ''} ${resizing ? 'pointer-events-none' : ''}`}>
                    <Terminal
                      sessionId={s.id}
                      scheme={hosts.find((h) => h.id === s.hostId)?.termScheme ?? undefined}
                      onClosed={() => markDisconnected(s.id)}
                    />
                  </div>
                </div>
                {showZones && <PaneDropZones onSplit={onZoneSplit} />}
              </div>
            )
          })}

          {paneDividers(layout).map((d) => {
            const boundary =
              d.dir === 'row'
                ? d.parent.left + d.parent.width * d.ratio
                : d.parent.top + d.parent.height * d.ratio
            const style: CSSProperties =
              d.dir === 'row'
                ? {
                    left: `${boundary}%`,
                    top: `${d.parent.top}%`,
                    height: `${d.parent.height}%`,
                    width: 10,
                    transform: 'translateX(-50%)',
                    cursor: 'col-resize',
                  }
                : {
                    left: `${d.parent.left}%`,
                    top: `${boundary}%`,
                    width: `${d.parent.width}%`,
                    height: 10,
                    transform: 'translateY(-50%)',
                    cursor: 'row-resize',
                  }
            const after =
              d.dir === 'row'
                ? "after:content-[''] after:absolute after:left-1/2 after:top-[8%] after:h-[84%] after:w-[2px] after:-translate-x-1/2 after:bg-transparent after:transition-colors hover:after:bg-[var(--brand)]"
                : "after:content-[''] after:absolute after:top-1/2 after:left-[8%] after:h-[2px] after:w-[84%] after:-translate-y-1/2 after:bg-transparent after:transition-colors hover:after:bg-[var(--brand)]"
            return (
              <div
                key={d.path.join('-') || 'root'}
                className={after}
                style={{ position: 'absolute', zIndex: 20, ...style }}
                onMouseDown={startDivider(d)}
              />
            )
          })}

          {activeSession?.status === 'disconnected' && (
            <div
              className="absolute inset-x-0 bottom-6 z-[6] mx-auto flex w-fit items-center gap-[10px] rounded-[11px] border border-[rgb(255_95_86_/_0.35)] bg-[linear-gradient(160deg,#1a1420,#12100f)] py-2 pl-[14px] pr-[10px] text-[12.5px] text-[var(--text-bright)] animate-[rise_0.2s_ease_both]"
              style={{ boxShadow: '0 14px 34px -14px rgba(0,0,0,0.8)' }}
            >
              <span className="h-2 w-2 rounded-full bg-[var(--red)] shadow-[0_0_8px_var(--red)]" />
              <span>Disconnected</span>
              <button className="cursor-pointer rounded-lg bg-[image:var(--gradient-brand)] px-[14px] py-[6px] text-[12.5px] font-bold text-[#1a0e0a]" onClick={() => reconnect(activeSession.id)}>
                Reconnect
              </button>
              <button className="cursor-pointer rounded-lg border border-[var(--border-2)] bg-transparent px-3 py-[6px] text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => closeSession(activeSession.id)}>
                Close tab
              </button>
            </div>
          )}
          {activeSession?.status === 'reconnecting' && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[var(--bg)]">
              <div className={connectCard} style={cardShadow}>
                <TerctlLoader size={54} glow={false} />
                <div className="text-[15px] font-semibold text-[var(--text)]">Reconnecting to {activeSession.label}…</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* inspector */}
      {activeSession && activeHost && showInspector && (
        <Inspector
          host={activeHost}
          status={activeSession.status}
          onClose={() => toggleInspector()}
          onDisconnect={() => closeSession(activeSession.id)}
          onDuplicate={() => connect(activeHost)}
          onOpenSftp={() => navigate({ to: '/transfer' })}
        />
      )}
    </div>
  )
}

function Inspector({
  host,
  status,
  onClose,
  onDisconnect,
  onDuplicate,
  onOpenSftp,
}: {
  host: Host
  status: 'connected' | 'disconnected' | 'reconnecting'
  onClose: () => void
  onDisconnect: () => void
  onDuplicate: () => void
  onOpenSftp: () => void
}) {
  const connected = status === 'connected'
  return (
    <div className="flex w-[288px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="rounded-[13px] border border-[var(--border-2)] bg-[linear-gradient(160deg,var(--bg-inspector-top),var(--bg-card-2))] p-[15px]">
        <div className="mb-3 flex items-center gap-[9px]">
          <span className="h-[9px] w-[9px] rounded-full" style={{ background: connected ? '#3ddc97' : '#ff5f56', boxShadow: `0 0 9px ${connected ? '#3ddc97' : '#ff5f56'}` }} />
          <span className="text-sm font-semibold">{host.label}</span>
          <span
            className="ml-auto rounded-md px-2 py-[3px] text-[10px] font-semibold tracking-[0.4px] text-[var(--green)]"
            style={connected ? { background: 'rgb(61 220 151 / 0.13)' } : { background: 'rgba(255,95,86,0.13)', color: '#ff5f56' }}
          >
            {status === 'reconnecting' ? 'RECONNECTING' : connected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
          <button className="h-6 w-6 shrink-0 cursor-pointer rounded-[7px] bg-foreground/[0.04] text-[var(--text-muted)] hover:bg-[var(--brand-soft-2)] hover:text-[var(--brand)]" onClick={onClose} title="Collapse details">
            ›
          </button>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-[14px] gap-y-[7px] text-[12px] [&>span:nth-child(odd)]:text-[var(--text-faint)]" style={{ fontFamily: 'var(--font-mono)' }}>
          <span>host</span>
          <span className="text-[var(--text-bright)]">{host.hostname}</span>
          <span>user</span>
          <span className="text-[var(--text-bright)]">{host.username}</span>
          <span>port</span>
          <span className="text-[var(--text-bright)]">{host.port}</span>
          <span>auth</span>
          <span className="text-[var(--blue)]">{host.authKind === 'key' ? host.keyRef ?? 'key' : 'password'}</span>
        </div>
      </div>

      <MetricsPanel hostId={host.id} connected={connected} />

      <div className="grid grid-cols-2 gap-2">
        <button className="cursor-pointer rounded-[9px] border border-[var(--border-2)] bg-foreground/[0.03] p-[9px] text-[12px] font-medium text-[var(--text-bright)] hover:border-[var(--brand-border)]" onClick={onOpenSftp}>
          Open SFTP
        </button>
        <button className="cursor-pointer rounded-[9px] border border-[var(--border-2)] bg-foreground/[0.03] p-[9px] text-[12px] font-medium text-[var(--text-bright)] hover:border-[var(--brand-border)]" title="Coming soon">
          Port Forward
        </button>
        <button className="cursor-pointer rounded-[9px] border border-[var(--border-2)] bg-foreground/[0.03] p-[9px] text-[12px] font-medium text-[var(--text-bright)] hover:border-[var(--brand-border)]" onClick={onDuplicate}>
          Duplicate
        </button>
        <button className="cursor-pointer rounded-[9px] border border-[rgb(255_95_86_/_0.35)] bg-[rgb(255_95_86_/_0.09)] p-[9px] text-[12px] font-semibold text-[var(--red)]" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </div>
  )
}

// Drop targets shown over a pane while a tab is being dragged. The narrow
// edge zones are the actual drop targets; the highlight previews the *half*
// the new pane will occupy, and glides smoothly between edges (VSCode-style).
const PREVIEW: Record<Edge, CSSProperties> = {
  left: { left: 0, top: 0, bottom: 0, right: '50%' },
  right: { left: '50%', top: 0, bottom: 0, right: 0 },
  top: { left: 0, right: 0, top: 0, bottom: '50%' },
  bottom: { left: 0, right: 0, top: '50%', bottom: 0 },
}

function PaneDropZones({ onSplit }: { onSplit: (edge: Edge) => void }) {
  const [over, setOver] = useState<Edge | null>(null)
  const target = (edge: Edge, style: CSSProperties) => (
    <div
      style={{ position: 'absolute', ...style }}
      onDragOver={(e) => {
        e.preventDefault()
        if (over !== edge) setOver(edge)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onSplit(edge)
        setOver(null)
      }}
    />
  )
  return (
    <div
      className="absolute inset-[6px] z-50 overflow-hidden rounded-lg"
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
      }}
    >
      {over && (
        <div
          className="pointer-events-none rounded-lg animate-[previewIn_0.14s_ease_both]"
          style={{ position: 'absolute', ...PREVIEW[over], background: 'color-mix(in srgb, var(--brand) 14%, transparent)', transition: 'inset 0.16s cubic-bezier(0.22,1,0.36,1)' }}
        />
      )}
      {target('left', { left: 0, top: 0, width: '30%', height: '100%' })}
      {target('right', { right: 0, top: 0, width: '30%', height: '100%' })}
      {target('top', { left: '30%', top: 0, width: '40%', height: '50%' })}
      {target('bottom', { left: '30%', bottom: 0, width: '40%', height: '50%' })}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  allTagsAtom,
  connectAtom,
  groupsAtom,
  hostsAtom,
  refreshAllAtom,
  setTagFilterAtom,
  tagFilterAtom,
} from '../../store/app'
import { confirmAtom, promptAtom } from '../../store/dialog'
import { hostsService } from '../../services/hosts.service'
import type { Group, Host } from '../../models'
import { HostForm } from './HostForm'

type HostFormState =
  | { mode: 'closed' }
  | { mode: 'create'; groupId: string | null }
  | { mode: 'edit'; host: Host }

const DOT: Record<string, string> = {
  connected: '#3ddc97',
  idle: '#f5b544',
  off: '#5f6875',
}

const btnAccent =
  'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] bg-[image:var(--gradient-brand)] px-4 py-[10px] text-[13px] font-bold text-[#1a0e0a]'
const btnGhost =
  'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border border-[var(--border-strong)] bg-white/[0.03] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--text-bright)] hover:border-[var(--brand-border)]'
const iconBtnBase =
  'flex h-[26px] w-[26px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] bg-white/[0.04] text-[var(--text-faint)]'
const iconBtn = `${iconBtnBase} hover:bg-[var(--brand-soft-2)] hover:text-[var(--brand)]`
const iconBtnDanger = `${iconBtnBase} hover:bg-[rgb(255_95_86_/_0.1)] hover:text-[var(--red)]`
const accentBtnShadow = { boxShadow: '0 4px 16px color-mix(in srgb, var(--brand) 30%, transparent)' } as const
const cardGradient = 'bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))]'

export function HostsPage() {
  const [hostForm, setHostForm] = useState<HostFormState>({ mode: 'closed' })
  const openCreate = (groupId: string | null) => setHostForm({ mode: 'create', groupId })
  const openEdit = (host: Host) => setHostForm({ mode: 'edit', host })

  return (
    <>
      <HostsBrowser onAddHost={openCreate} onEditHost={openEdit} />
      {hostForm.mode === 'create' && (
        <HostForm defaultGroupId={hostForm.groupId} onClose={() => setHostForm({ mode: 'closed' })} />
      )}
      {hostForm.mode === 'edit' && (
        <HostForm host={hostForm.host} defaultGroupId={null} onClose={() => setHostForm({ mode: 'closed' })} />
      )}
    </>
  )
}

interface BrowserProps {
  onAddHost: (groupId: string | null) => void
  onEditHost: (host: Host) => void
}

function HostsBrowser({ onAddHost, onEditHost }: BrowserProps) {
  const hosts = useAtomValue(hostsAtom)
  const groups = useAtomValue(groupsAtom)
  const allTags = useAtomValue(allTagsAtom)
  const tagFilter = useAtomValue(tagFilterAtom)
  const connect = useSetAtom(connectAtom)
  const refreshAll = useSetAtom(refreshAllAtom)
  const setTagFilter = useSetAtom(setTagFilterAtom)
  const prompt = useSetAtom(promptAtom)
  const confirm = useSetAtom(confirmAtom)
  const navigate = useNavigate()

  const [path, setPath] = useState<string[]>([])
  const [query, setQuery] = useState('')

  const currentGroupId = path.length ? path[path.length - 1] : null

  const countDescendants = useMemo(() => {
    const childrenOf = new Map<string | null, Group[]>()
    for (const g of groups) {
      const key = g.parentId
      const arr = childrenOf.get(key) ?? []
      arr.push(g)
      childrenOf.set(key, arr)
    }
    const hostsByGroup = new Map<string | null, number>()
    for (const h of hosts) {
      const key = h.groupId
      hostsByGroup.set(key, (hostsByGroup.get(key) ?? 0) + 1)
    }
    const memo = new Map<string, number>()
    const count = (gid: string): number => {
      if (memo.has(gid)) return memo.get(gid)!
      let n = hostsByGroup.get(gid) ?? 0
      for (const child of childrenOf.get(gid) ?? []) n += count(child.id)
      memo.set(gid, n)
      return n
    }
    return count
  }, [groups, hosts])

  const q = query.trim().toLowerCase()
  const matchesQuery = (h: Host) =>
    !q ||
    h.label.toLowerCase().includes(q) ||
    h.hostname.toLowerCase().includes(q) ||
    h.username.toLowerCase().includes(q) ||
    h.tags.some((t) => t.toLowerCase().includes(q))

  const searching = q.length > 0
  const subgroups = searching ? [] : groups.filter((g) => g.parentId === currentGroupId)
  const hostsHere = hosts
    .filter((h) => searching || (h.groupId ?? null) === currentGroupId)
    .filter((h) => (tagFilter ? h.tags.includes(tagFilter) : true))
    .filter(matchesQuery)

  const rootGroupCount = groups.filter((g) => g.parentId === null).length
  const isEmpty = !searching && hosts.length === 0 && groups.length === 0

  const breadcrumb = [{ id: null as string | null, name: 'Hosts' }]
  for (const gid of path) {
    const g = groups.find((x) => x.id === gid)
    if (g) breadcrumb.push({ id: g.id, name: g.name })
  }

  const chips = ['All', ...allTags]

  const openHost = (h: Host) => {
    void connect(h)
    navigate({ to: '/sessions' })
  }

  const handleAddGroup = async () => {
    const name = await prompt({ title: 'New group', placeholder: 'e.g. Production', confirmLabel: 'Create' })
    if (!name) return
    await hostsService.addGroup(name, currentGroupId)
    await refreshAll()
  }

  const handleRenameGroup = async (g: Group) => {
    const name = await prompt({ title: 'Rename group', initialValue: g.name, confirmLabel: 'Rename' })
    if (!name || name === g.name) return
    await hostsService.renameGroup(g.id, name)
    await refreshAll()
  }

  const handleDeleteGroup = async (g: Group) => {
    const ok = await confirm({
      title: `Delete "${g.name}"?`,
      message: 'Its hosts move to Ungrouped and its subgroups move up a level — nothing is deleted except the group.',
      confirmLabel: 'Delete group',
      danger: true,
    })
    if (!ok) return
    await hostsService.deleteGroup(g.id)
    await refreshAll()
  }

  const handleDeleteHost = async (h: Host) => {
    const ok = await confirm({
      title: `Delete "${h.label}"?`,
      message: 'This also removes its saved credentials from the keychain.',
      confirmLabel: 'Delete server',
      danger: true,
    })
    if (!ok) return
    await hostsService.remove(h.id)
    await refreshAll()
  }

  const insideGroup = path.length > 0
  const currentGroup = insideGroup ? groups.find((g) => g.id === currentGroupId) : null

  return (
    <div className="flex-1 overflow-y-auto bg-(--bg)">
      <div className="m-0 px-8 pt-4.5 pb-8">
        <div className="mb-4.5 flex items-end gap-3">
          <div>
            <h1 className="m-0 text-[26px] font-bold tracking-[-0.3px]">Hosts</h1>
            <p className="mt-1.25 mb-0 text-[13px] text-(--text-muted)">
              {hosts.length} saved connection{hosts.length === 1 ? '' : 's'} across {rootGroupCount}{' '}
              environment{rootGroupCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex-1" />
          {!isEmpty && (
            <>
              <div className="flex w-65 items-center gap-2 rounded-[10px] border border-(--border-2) bg-white/4 px-3.25 py-2.25">
                <SearchIcon />
                <input
                  className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] text-(--text) outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                  placeholder="Search hosts, tags, IPs…"
                />
              </div>
              <button className={btnGhost} onClick={handleAddGroup}>
                <FolderPlusIcon />
                New Group
              </button>
              <button className={btnAccent} style={accentBtnShadow} onClick={() => onAddHost(currentGroupId)}>
                <PlusIcon stroke="#1a0e0a" width={15} sw={2.6} />
                New Connection
              </button>
            </>
          )}
        </div>

        {allTags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {chips.map((chip) => {
              const active = chip === 'All' ? tagFilter === null : tagFilter === chip
              return (
                <span
                  key={chip}
                  className={`cursor-pointer rounded-[20px] border px-[13px] py-[6px] text-[12px] font-medium ${active ? 'border-transparent bg-[var(--brand-soft-2)] text-[var(--brand)]' : 'border-[var(--border-2)] bg-white/[0.04] text-[var(--text-dim)]'}`}
                  style={active ? { borderColor: 'color-mix(in srgb, var(--brand) 35%, transparent)' } : undefined}
                  onClick={() => setTagFilter(chip === 'All' ? null : chip)}
                >
                  {chip}
                </span>
              )
            })}
          </div>
        )}

        {insideGroup && (
          <div className="mx-0 mt-0 mb-5 flex flex-wrap items-center gap-[6px]">
            {breadcrumb.map((c, i) => {
              const last = i === breadcrumb.length - 1
              return (
                <span key={c.id ?? 'root'} className="inline-flex items-center gap-[6px]">
                  <button
                    className="cursor-pointer border-none bg-transparent px-[3px] py-[2px] text-[13.5px] font-semibold hover:text-[var(--brand)]"
                    style={{ color: last ? 'var(--text)' : 'var(--text-muted)' }}
                    onClick={() => setPath(path.slice(0, i))}
                  >
                    {c.name}
                  </button>
                  {!last && <span className="text-[14px] text-[var(--text-faintest)]">›</span>}
                </span>
              )
            })}
          </div>
        )}

        {subgroups.length > 0 && (
          <>
            <div className="mx-0 mt-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.9px] text-[var(--text-faint)]">
              {insideGroup ? 'Subgroups' : 'Groups'}
            </div>
            <div className="mb-7 grid gap-[10px]" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))' }}>
              {subgroups.map((g) => (
                <div
                  key={g.id}
                  className={`group flex cursor-pointer items-center gap-[10px] rounded-[11px] border border-[var(--border-2)] ${cardGradient} px-[11px] py-[9px] text-left transition-colors duration-150 hover:border-[var(--brand-border)]`}
                  onClick={() => setPath([...path, g.id])}
                >
                  <div
                    className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)] [&_svg]:h-4 [&_svg]:w-4"
                    style={{ boxShadow: '0 2px 9px color-mix(in srgb, var(--brand) 30%, transparent)' }}
                  >
                    <GridIcon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[var(--text)]">{g.name}</div>
                    <div className="mt-[1px] text-[11px] text-[var(--text-muted)]">{countDescendants(g.id)} Hosts</div>
                  </div>
                  {/* Actions reveal on hover so the name gets full width by default. */}
                  <div className="hidden shrink-0 items-center gap-[6px] group-hover:flex">
                    <button
                      className={iconBtn}
                      title="Rename group"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRenameGroup(g)
                      }}
                    >
                      <EditIcon />
                    </button>
                    <button
                      className={iconBtnDanger}
                      title="Delete group"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteGroup(g)
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <ChevronIcon />
                </div>
              ))}
            </div>
          </>
        )}

        {isEmpty && <EmptyHosts onAddHost={() => onAddHost(null)} onNewGroup={handleAddGroup} />}

        {!isEmpty && (
          <div className="mx-0 mt-2 mb-[13px] flex items-center gap-[9px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.9px] text-[var(--text-faint)]">Hosts</span>
            {currentGroup && <span className="text-[12px] font-semibold text-[var(--text-bright)]">{currentGroup.name}</span>}
            <span className="rounded-md bg-white/5 px-2 py-[2px] text-[11px] text-[var(--text-faint)]">{hostsHere.length}</span>
          </div>
        )}
        {!isEmpty && (
          <div className="mb-6 grid gap-[10px]" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(228px,1fr))' }}>
            {hostsHere.map((h) => {
              const dot = DOT.connected
              return (
                <button
                  key={h.id}
                  className={`flex cursor-pointer flex-col rounded-[11px] border border-[var(--border-2)] ${cardGradient} px-3 py-[11px] text-left transition-all duration-150 hover:-translate-y-px hover:border-[var(--brand-border)]`}
                  onClick={() => openHost(h)}
                >
                  <div className="mb-[6px] flex items-center gap-[9px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot, boxShadow: `0 0 9px ${dot}` }} />
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[var(--text)]">{h.label}</span>
                    <span
                      className="ml-auto cursor-pointer px-1 text-[15px] leading-[0.5] text-[var(--text-faint)] hover:text-[var(--brand)]"
                      title="Edit server"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditHost(h)
                      }}
                    >
                      ⋯
                    </span>
                  </div>
                  <div className="mb-2 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {h.username}@{h.hostname}
                  </div>
                  <div className="mb-2 flex flex-wrap gap-[5px] empty:hidden">
                    {h.tags.map((t) => (
                      <span key={t} className="rounded-[5px] bg-white/5 px-[7px] py-[2px] text-[10px] text-[var(--text-dim)]">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center gap-[6px] border-t border-white/5 pt-2 text-[10.5px] text-[var(--text-faint)]">
                    <span style={{ color: dot }}>●</span> saved · {h.authKind === 'key' ? 'key' : 'password'} · :{h.port}
                    <span className="flex-1" />
                    <span
                      className="flex cursor-pointer text-[var(--text-faint)] hover:text-[var(--red)]"
                      title="Delete server"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteHost(h)
                      }}
                    >
                      <TrashIcon />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyHosts({ onAddHost, onNewGroup }: { onAddHost: () => void; onNewGroup: () => void }) {
  return (
    <div className="flex flex-col items-center px-5 pt-9 pb-[60px] text-center animate-[rise_0.4s_ease_both]">
      <div className="mb-5 animate-[bootFloaty_7s_ease-in-out_infinite]">
        <svg width="300" height="196" viewBox="0 0 300 196" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="ehGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="150" cy="98" r="80" fill="url(#ehGlow)" />
          <g stroke="var(--border-strong)" strokeWidth="1.4" strokeDasharray="3 6" strokeLinecap="round">
            <path d="M150 98 L64 52" />
            <path d="M150 98 L236 52" />
            <path d="M150 98 L150 168" />
          </g>
          <g transform="translate(40,34)">
            <rect width="48" height="36" rx="8" fill="var(--bg-card)" stroke="var(--border-2)" />
            <rect x="10" y="11" width="20" height="3" rx="1.5" fill="var(--text-faint)" />
            <rect x="10" y="19" width="14" height="3" rx="1.5" fill="var(--text-faintest)" />
            <circle cx="38" cy="12.5" r="2.2" fill="var(--green)" />
          </g>
          <g transform="translate(212,34)">
            <rect width="48" height="36" rx="8" fill="var(--bg-card)" stroke="var(--border-2)" />
            <rect x="10" y="11" width="20" height="3" rx="1.5" fill="var(--text-faint)" />
            <rect x="10" y="19" width="14" height="3" rx="1.5" fill="var(--text-faintest)" />
            <circle cx="38" cy="12.5" r="2.2" fill="var(--amber)" />
          </g>
          <g transform="translate(126,150)">
            <rect width="48" height="36" rx="9" fill="none" stroke="var(--brand)" strokeOpacity="0.65" strokeWidth="1.6" strokeDasharray="5 4" />
            <path d="M24 11 v14 M17 18 h14" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g transform="translate(124,72)">
            <rect width="52" height="52" rx="14" fill="#17181b" stroke="rgba(255,255,255,0.07)" />
            <g transform="translate(13,13)" fill="#f0f0f2">
              <rect x="0" y="0" width="26" height="5.7" />
              <rect x="0" y="20.3" width="26" height="5.7" />
              <rect x="0" y="5.7" width="4.1" height="4.5" />
              <rect x="0" y="15.8" width="4.1" height="4.5" />
              <rect x="21.9" y="5.7" width="4.1" height="4.5" />
              <rect x="21.9" y="15.8" width="4.1" height="4.5" />
            </g>
          </g>
        </svg>
      </div>
      <h2 className="mt-0 mb-2 text-[19px] font-bold text-[var(--text)]">No connections yet</h2>
      <p className="mt-0 mb-[22px] max-w-[350px] text-[13.5px] leading-[1.55] text-[var(--text-muted)]">
        Add your first server and it lands here — one click to open a secure terminal, anytime.
      </p>
      <div className="flex gap-[10px]">
        <button className={btnAccent} style={accentBtnShadow} onClick={onAddHost}>
          <PlusIcon stroke="#1a0e0a" width={15} sw={2.6} />
          New Connection
        </button>
        <button className={btnGhost} onClick={onNewGroup}>
          <FolderPlusIcon />
          New Group
        </button>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5f6875" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </svg>
  )
}
function PlusIcon({ stroke, width, sw }: { stroke: string; width: number; sw: number }) {
  return (
    <svg width={width} height={width} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function FolderPlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa3b2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h6l2 2h10v10H3z" />
      <path d="M11 13h4M13 11v4" />
    </svg>
  )
}
function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
      <rect x="3" y="3" width="8" height="8" rx="1.6" />
      <rect x="13" y="3" width="8" height="8" rx="1.6" opacity="0.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.6" opacity="0.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.6" />
    </svg>
  )
}
function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  )
}
function ChevronIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5f6875" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

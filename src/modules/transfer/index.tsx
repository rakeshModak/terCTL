import { useCallback, useEffect, useRef, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { hostsAtom } from '../../store/app'
import { promptAtom } from '../../store/dialog'
import { sftpService } from '../../services/sftp.service'
import type { FileEntryType } from '@/types/file'
import type { HostType } from '@/types/host'
import { TerctlLoader } from '../../components/chrome/TerctlLogo'
import { LOCAL_MACHINE_LABEL } from '../../lib/platform'

const mono = { fontFamily: 'var(--font-mono)' } as const
const menuShadow = { boxShadow: '0 20px 50px -18px rgba(0,0,0,0.75)' } as const

function parentPath(p: string): string {
  const trimmed = p.replace(/\/+$/, '')
  const idx = trimmed.lastIndexOf('/')
  if (idx <= 0) return '/'
  return trimmed.slice(0, idx)
}
function joinPath(dir: string, name: string): string {
  return dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`
}
function fmtSize(b: number, isDir: boolean): string {
  if (isDir) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`
}
function fmtDate(unix: number | null): string {
  if (!unix) return ''
  const d = new Date(unix * 1000)
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  )
}

export default function TransferView() {
  const hosts = useAtomValue(hostsAtom)
  const prompt = useSetAtom(promptAtom)
  const [hostId, setHostId] = useState<string>('')

  const [localPath, setLocalPath] = useState('')
  const [remotePath, setRemotePath] = useState('')
  const [local, setLocal] = useState<FileEntryType[]>([])
  const [remote, setRemote] = useState<FileEntryType[]>([])
  const [remoteBusy, setRemoteBusy] = useState(false)
  const [remoteErr, setRemoteErr] = useState<string | null>(null)
  const [status, setStatus] = useState<{ msg: string; kind: 'info' | 'error' } | null>(null)

  const loadLocal = useCallback(async (path: string) => {
    try {
      const entries = await sftpService.localList(path)
      setLocal(entries)
      setLocalPath(path)
    } catch (e) {
      setStatus({ msg: String(e), kind: 'error' })
    }
  }, [])

  const loadRemote = useCallback(async (hid: string, path: string) => {
    setRemoteBusy(true)
    setRemoteErr(null)
    try {
      const entries = await sftpService.list(hid, path)
      setRemote(entries)
      setRemotePath(path)
    } catch (e) {
      setRemoteErr(String(e))
    } finally {
      setRemoteBusy(false)
    }
  }, [])

  useEffect(() => {
    void sftpService.localHome().then((h) => loadLocal(h))
  }, [loadLocal])

  useEffect(() => {
    if (!hostId) return
    return () => {
      void sftpService.disconnect(hostId)
    }
  }, [hostId])

  useEffect(() => {
    if (!hostId) {
      setRemote([])
      setRemotePath('')
      return
    }
    setRemoteBusy(true)
    setRemoteErr(null)
    sftpService
      .home(hostId)
      .then((h) => loadRemote(hostId, h))
      .catch((e) => {
        setRemoteErr(String(e))
        setRemoteBusy(false)
      })
  }, [hostId, loadRemote])

  const upload = async (f: FileEntryType) => {
    if (!hostId) return
    setStatus({ msg: `Uploading ${f.name}…`, kind: 'info' })
    try {
      await sftpService.upload(hostId, f.path, joinPath(remotePath, f.name))
      setStatus({ msg: `Uploaded ${f.name} → ${remotePath}`, kind: 'info' })
      await loadRemote(hostId, remotePath)
    } catch (e) {
      setStatus({ msg: `Upload failed: ${e}`, kind: 'error' })
    }
  }
  const download = async (f: FileEntryType) => {
    if (!hostId) return
    setStatus({ msg: `Downloading ${f.name}…`, kind: 'info' })
    try {
      await sftpService.download(hostId, f.path, joinPath(localPath, f.name))
      setStatus({ msg: `Downloaded ${f.name} → ${localPath}`, kind: 'info' })
      await loadLocal(localPath)
    } catch (e) {
      setStatus({ msg: `Download failed: ${e}`, kind: 'error' })
    }
  }

  const newLocalFolder = async () => {
    const name = await prompt({ title: 'New folder', placeholder: 'Folder name', confirmLabel: 'Create' })
    if (!name) return
    try {
      await sftpService.localMkdir(joinPath(localPath, name))
      await loadLocal(localPath)
    } catch (e) {
      setStatus({ msg: `Couldn't create folder: ${e}`, kind: 'error' })
    }
  }
  const renameLocal = async (f: FileEntryType) => {
    const name = await prompt({ title: `Rename “${f.name}”`, initialValue: f.name, confirmLabel: 'Rename' })
    if (!name || name === f.name) return
    try {
      await sftpService.localRename(f.path, joinPath(parentPath(f.path), name))
      await loadLocal(localPath)
    } catch (e) {
      setStatus({ msg: `Rename failed: ${e}`, kind: 'error' })
    }
  }
  const newRemoteFolder = async () => {
    if (!hostId) return
    const name = await prompt({ title: 'New folder', placeholder: 'Folder name', confirmLabel: 'Create' })
    if (!name) return
    try {
      await sftpService.mkdir(hostId, joinPath(remotePath, name))
      await loadRemote(hostId, remotePath)
    } catch (e) {
      setStatus({ msg: `Couldn't create folder: ${e}`, kind: 'error' })
    }
  }
  const renameRemote = async (f: FileEntryType) => {
    if (!hostId) return
    const name = await prompt({ title: `Rename “${f.name}”`, initialValue: f.name, confirmLabel: 'Rename' })
    if (!name || name === f.name) return
    try {
      await sftpService.rename(hostId, f.path, joinPath(parentPath(f.path), name))
      await loadRemote(hostId, remotePath)
    } catch (e) {
      setStatus({ msg: `Rename failed: ${e}`, kind: 'error' })
    }
  }

  const selectedHost = hosts.find((h) => h.id === hostId)

  return (
    <div className="flex flex-1 flex-col min-w-0 bg-[var(--bg)]">
      <div className="flex items-center gap-[14px] border-b border-[var(--border)] px-6 py-4">
        <h1 className="m-0 text-lg font-bold">Transfer</h1>
        <HostSelect hosts={hosts} value={hostId} onChange={setHostId} />
        <div className="flex-1" />
        {status && (
          <span
            className="max-w-[460px] overflow-hidden text-ellipsis whitespace-nowrap text-[12px]"
            style={{ ...mono, color: status.kind === 'error' ? 'var(--red)' : 'var(--green)' }}
          >
            {status.msg}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <Pane
          title={LOCAL_MACHINE_LABEL}
          side="local"
          path={localPath}
          entries={local}
          onOpen={(f) => loadLocal(f.path)}
          onUp={() => loadLocal(parentPath(localPath))}
          onRefresh={() => loadLocal(localPath)}
          onNewFolder={newLocalFolder}
          onRename={renameLocal}
          action={{ label: 'Upload', dir: '→', onClick: upload, enabled: !!hostId }}
        />
        <Pane
          title={selectedHost ? selectedHost.label : 'Remote'}
          side="remote"
          path={remotePath}
          entries={remote}
          busy={remoteBusy}
          error={remoteErr}
          empty={!hostId ? 'Select a server to browse its files.' : undefined}
          disabled={!hostId}
          onOpen={(f) => loadRemote(hostId, f.path)}
          onUp={() => loadRemote(hostId, parentPath(remotePath))}
          onRefresh={() => hostId && loadRemote(hostId, remotePath)}
          onNewFolder={newRemoteFolder}
          onRename={renameRemote}
          action={{ label: 'Download', dir: '←', onClick: download, enabled: true }}
        />
      </div>
    </div>
  )
}

function HostSelect({
  hosts,
  value,
  onChange,
}: {
  hosts: HostType[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const selected = hosts.find((h) => h.id === value)
  return (
    <div className="relative" ref={ref}>
      <button
        className="flex min-w-[240px] cursor-pointer items-center gap-2 rounded-[9px] border border-[var(--border-2)] bg-[var(--bg-deep)] px-[11px] py-2 text-[12.5px] text-[var(--text)] hover:border-[var(--brand-border)]"
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? (
          <>
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--green)] shadow-[0_0_6px_var(--green)]" />
            <span className="font-semibold">{selected.label}</span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--text-faint)]" style={mono}>
              {selected.username}@{selected.hostname}
            </span>
          </>
        ) : (
          <span className="text-[var(--text-muted)]">Select a server…</span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="ml-auto shrink-0 text-[var(--text-faint)]">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[340px] min-w-[300px] animate-[rise_0.14s_ease_both] overflow-y-auto rounded-[11px] border border-[var(--border-2)] bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))] p-[6px]"
          style={menuShadow}
        >
          {hosts.length === 0 && <div className="p-3 text-[12px] text-[var(--text-faint)]">No saved hosts</div>}
          {hosts.map((h) => (
            <button
              key={h.id}
              className={`flex w-full cursor-pointer items-center gap-[9px] rounded-lg px-[10px] py-[9px] text-left ${h.id === value ? 'bg-[var(--brand-soft-2)]' : 'bg-transparent hover:bg-foreground/5'}`}
              onClick={() => {
                onChange(h.id)
                setOpen(false)
              }}
            >
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--green)] shadow-[0_0_6px_var(--green)]" />
              <span className="text-[13px] font-medium text-[var(--text)]">{h.label}</span>
              <span className="ml-auto text-[11px] text-[var(--text-faint)]" style={mono}>{h.username}@{h.hostname}</span>
              {h.id === value && <span className="shrink-0 text-[13px] text-[var(--brand)]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#f0b34a' }}>
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
    </svg>
  )
}
function FileIcon({ link }: { link?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" style={{ color: link ? '#5b9dff' : '#8b95a6' }}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
    </svg>
  )
}

interface PaneProps {
  title: string
  side: 'local' | 'remote'
  path: string
  entries: FileEntryType[]
  busy?: boolean
  error?: string | null
  empty?: string
  disabled?: boolean
  onOpen: (f: FileEntryType) => void
  onUp: () => void
  onRefresh: () => void
  onNewFolder: () => void
  onRename: (f: FileEntryType) => void
  action: { label: string; dir: string; onClick: (f: FileEntryType) => void; enabled: boolean }
}

function Pane({
  title, side, path, entries, busy, error, empty, disabled,
  onOpen, onUp, onRefresh, onNewFolder, onRename, action,
}: PaneProps) {
  const local = side === 'local'
  const [showHidden, setShowHidden] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const visible = showHidden ? entries : entries.filter((f) => !f.name.startsWith('.'))
  const selectedEntry = entries.find((f) => f.path === selected) ?? null

  return (
    <div className="flex min-w-0 flex-1 flex-col border-r border-[var(--border)] last:border-r-0">
      <div className="box-border flex h-[52px] items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-panel)] px-[18px]">
        <span className="flex shrink-0 items-center" style={{ color: local ? 'var(--text-dim)' : 'var(--brand)' }}>
          {local ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <path d="M8 20h8" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <rect x="3" y="4" width="18" height="5" rx="1.5" />
              <rect x="3" y="14" width="18" height="5" rx="1.5" />
            </svg>
          )}
        </span>
        <span className="shrink-0 text-[12.5px] font-semibold">{title}</span>
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[var(--text-faint)]" style={mono}>
          {path}
        </span>
        {path && (
          <button
            className="h-[26px] w-[26px] shrink-0 cursor-pointer rounded-[7px] border border-[var(--border-2)] bg-foreground/[0.04] text-[var(--text-muted)] hover:border-[var(--brand-border)] hover:text-[var(--brand)]"
            onClick={onUp}
            title="Up one level"
          >
            ↑
          </button>
        )}
        <PaneMenu
          disabled={disabled}
          showHidden={showHidden}
          hasSelection={!!selectedEntry}
          onToggleHidden={() => setShowHidden((v) => !v)}
          onRefresh={onRefresh}
          onNewFolder={onNewFolder}
          onRename={() => selectedEntry && onRename(selectedEntry)}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {(empty || error || busy) && (
          <div className="flex h-full min-h-[160px] items-center justify-center p-5 text-center text-[13px] text-[var(--text-faint)]">
            {busy ? (
              <TerctlLoader size={40} />
            ) : (
              <span style={{ color: error ? 'var(--red)' : 'var(--text-faint)' }}>{error ?? empty}</span>
            )}
          </div>
        )}
        {!empty && !error && !busy &&
          visible.map((f) => (
            <div
              key={f.path}
              className={`group flex items-center gap-3 border-b border-foreground/[0.03] px-[18px] py-[9px] ${selected === f.path ? 'bg-[var(--brand-soft)]' : 'hover:bg-foreground/[0.03]'}`}
              style={selected === f.path ? { boxShadow: 'inset 2px 0 0 var(--brand)' } : undefined}
              onClick={() => setSelected(f.path)}
              onDoubleClick={() => f.isDir && onOpen(f)}
            >
              <span className="flex w-[18px] shrink-0 justify-center">
                {f.isDir ? <FolderIcon /> : <FileIcon link={f.isLink} />}
              </span>
              <span
                className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px]"
                style={{ ...mono, color: f.isDir ? '#e8d3a8' : 'var(--text-bright)', cursor: f.isDir ? 'pointer' : 'default' }}
              >
                {f.name}
              </span>
              <span className="w-[70px] text-right text-[11px] text-[var(--text-faint)]" style={mono}>{fmtSize(f.size, f.isDir)}</span>
              <span className="w-[96px] text-right text-[11px] text-[var(--text-faint)]" style={mono}>{fmtDate(f.modified)}</span>
              {!f.isDir && action.enabled && (
                <button
                  className="h-6 w-[26px] shrink-0 cursor-pointer rounded-[7px] border border-[var(--brand-border)] bg-[var(--brand-soft)] text-[13px] text-[var(--brand)] opacity-0 transition-opacity group-hover:opacity-100"
                  title={`${action.label} ${f.name}`}
                  onClick={(e) => { e.stopPropagation(); action.onClick(f) }}
                >
                  {action.dir}
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}

function PaneMenu({
  disabled, showHidden, hasSelection, onToggleHidden, onRefresh, onNewFolder, onRename,
}: {
  disabled?: boolean
  showHidden: boolean
  hasSelection: boolean
  onToggleHidden: () => void
  onRefresh: () => void
  onNewFolder: () => void
  onRename: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  const item = 'flex w-full cursor-pointer items-center gap-2 rounded-[7px] bg-transparent px-[10px] py-2 text-left text-[12.5px] text-[var(--text)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--text)]'

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        className="h-[26px] w-[26px] shrink-0 cursor-pointer rounded-[7px] border border-[var(--border-2)] bg-foreground/[0.04] text-[var(--text-muted)] hover:border-[var(--brand-border)] hover:text-[var(--brand)] disabled:cursor-default disabled:opacity-40"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title="Actions"
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[190px] animate-[rise_0.14s_ease_both] rounded-[11px] border border-[var(--border-2)] bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))] p-[6px]"
          style={menuShadow}
        >
          <button className={item} onClick={run(onToggleHidden)}>
            <span className="w-3 shrink-0 text-[11px] text-[var(--brand)]">{showHidden ? '✓' : ''}</span>
            Show hidden files
          </button>
          <button className={item} onClick={run(onRefresh)}>
            <span className="w-3 shrink-0 text-[11px] text-[var(--brand)]" />
            Refresh
          </button>
          <button className={item} onClick={run(onNewFolder)}>
            <span className="w-3 shrink-0 text-[11px] text-[var(--brand)]" />
            New folder
          </button>
          <button className={item} onClick={run(onRename)} disabled={!hasSelection}>
            <span className="w-3 shrink-0 text-[11px] text-[var(--brand)]" />
            Rename{hasSelection ? '' : '…'}
          </button>
        </div>
      )}
    </div>
  )
}

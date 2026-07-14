import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { allTagsAtom, groupsAtom, refreshAllAtom } from '../../store/app'
import { promptAtom } from '../../store/dialog'
import { hostsService } from '../../services/hosts.service'
import { credentialsService } from '../../services/credentials.service'
import type { AuthKind, Host } from '../../models'
import { TERM_SWATCH } from '../../constants/terminal-schemes'

const fieldBase =
  'rounded-[9px] border border-[var(--border-2)] bg-[var(--bg-deep)] text-[13px] font-normal normal-case tracking-normal text-[var(--text)] transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-ring)] focus:outline-none'
const inputCls = `${fieldBase} px-3 py-[10px] placeholder:text-[var(--text-faint)]`
const selectCls = `${fieldBase} cursor-pointer appearance-none py-[10px] pl-3 pr-[34px] bg-no-repeat`
const fieldRow = 'flex flex-col gap-[6px] text-[11px] font-semibold uppercase tracking-[0.5px] text-[var(--text-faint)]'
const drawerBtn =
  'cursor-pointer rounded-[9px] border border-[var(--border-2)] bg-white/[0.04] px-[18px] py-[9px] text-[13px] font-semibold text-[var(--text)] hover:border-[var(--border-strong)]'
const drawerBtnPrimary =
  'cursor-pointer rounded-[9px] bg-[image:var(--gradient-accent)] px-[18px] py-[9px] text-[13px] font-semibold text-[#1a0e0a] disabled:cursor-not-allowed disabled:opacity-60'
// Custom select arrow (replaces the dated native macOS dropdown chevron).
const selectArrow = {
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237d8696' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>\")",
  backgroundPosition: 'right 11px center',
} as const

interface HostFormProps {
  host?: Host
  defaultGroupId: string | null
  onClose: () => void
}

export function HostForm({ host, defaultGroupId, onClose }: HostFormProps) {
  const groups = useAtomValue(groupsAtom)
  const allTags = useAtomValue(allTagsAtom)
  const refreshAll = useSetAtom(refreshAllAtom)
  const prompt = useSetAtom(promptAtom)

  const [label, setLabel] = useState(host?.label ?? '')
  const [hostname, setHostname] = useState(host?.hostname ?? '')
  const [port, setPort] = useState(String(host?.port ?? 22))
  const [username, setUsername] = useState(host?.username ?? 'root')
  const [authKind, setAuthKind] = useState<AuthKind>(host?.authKind ?? 'key')
  const [keyPath, setKeyPath] = useState(host?.keyRef ?? '~/.ssh/id_ed25519')
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [groupId, setGroupId] = useState<string | null>(host?.groupId ?? defaultGroupId)
  const [tags, setTags] = useState<string[]>(host?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [termScheme, setTermScheme] = useState<string | null>(host?.termScheme ?? null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagInput('')
  }

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1))
    }
  }

  const handleNewGroup = async () => {
    const name = await prompt({
      title: 'New group',
      placeholder: 'e.g. SkillDrift',
      confirmLabel: 'Create',
    })
    if (!name) return
    const group = await hostsService.addGroup(name)
    await refreshAll()
    setGroupId(group.id)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const shared = {
        label: label || `${username}@${hostname}`,
        hostname,
        port: Number(port),
        username,
        authKind,
        keyRef: authKind === 'key' ? keyPath : null,
        groupId,
        tags,
        accent: null,
        termScheme,
      }

      let savedId: string
      if (host) {
        await hostsService.update({ ...host, ...shared })
        savedId = host.id
      } else {
        savedId = (await hostsService.add(shared)).id
      }

      if (authKind === 'key' && passphrase) {
        await credentialsService.save(savedId, 'passphrase', passphrase)
      }
      if (authKind === 'password' && password) {
        await credentialsService.save(savedId, 'password', password)
      }

      await refreshAll()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-end bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <form
        className="relative flex h-full w-[440px] max-w-[94vw] flex-col border-l border-[var(--border-2)] bg-[linear-gradient(180deg,#12151b,#0b0d12)]"
        style={{ boxShadow: '-30px 0 70px -24px rgba(0,0,0,0.8)', animation: 'slide-in-right 0.28s cubic-bezier(0.22,1,0.36,1) both' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 pt-5 pb-4">
          <div className="flex flex-1 items-center gap-3">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-[var(--accent-soft-2)] text-[var(--accent)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 17l6-5-6-5M13 18h7" />
              </svg>
            </span>
            <div>
              <div className="text-base font-bold tracking-[-0.2px]">{host ? 'Edit server' : 'Add server'}</div>
              <div className="mt-[1px] text-[12px] text-[var(--text-muted)]">SSH connection details</div>
            </div>
          </div>
          <button type="button" className="h-[30px] w-[30px] shrink-0 cursor-pointer rounded-lg bg-white/[0.04] text-[13px] text-[var(--text-muted)] hover:bg-white/[0.08] hover:text-[var(--text)]" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-[15px] overflow-y-auto p-5">
          <label className={fieldRow}>
            Label
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.currentTarget.value)} placeholder="api" />
          </label>

          <div className="flex gap-[10px]">
            <label className={fieldRow}>
              Host
              <input
                className={inputCls}
                value={hostname}
                onChange={(e) => setHostname(e.currentTarget.value)}
                placeholder="203.0.113.10"
                required
              />
            </label>
            <label className={`${fieldRow} flex-[0_0_84px]`}>
              Port
              <input className={inputCls} value={port} onChange={(e) => setPort(e.currentTarget.value)} />
            </label>
          </div>

          <label className={fieldRow}>
            User
            <input className={inputCls} value={username} onChange={(e) => setUsername(e.currentTarget.value)} required />
          </label>

          <label className={fieldRow}>
            Auth
            <select className={selectCls} style={selectArrow} value={authKind} onChange={(e) => setAuthKind(e.currentTarget.value as AuthKind)}>
              <option value="key">Private key</option>
              <option value="password">Password</option>
            </select>
          </label>

          {authKind === 'key' ? (
            <>
              <label className={fieldRow}>
                Key path
                <input className={inputCls} value={keyPath} onChange={(e) => setKeyPath(e.currentTarget.value)} />
              </label>
              <label className={fieldRow}>
                Passphrase
                <input
                  className={inputCls}
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.currentTarget.value)}
                  placeholder={host ? '(leave blank to keep current)' : '(optional)'}
                />
              </label>
            </>
          ) : (
            <label className={fieldRow}>
              Password
              <input
                className={inputCls}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                placeholder={host ? '(leave blank to keep current)' : ''}
              />
            </label>
          )}

          <label className={fieldRow}>
            Group
            <select
              className={selectCls}
              style={selectArrow}
              value={groupId ?? ''}
              onChange={(e) => {
                if (e.currentTarget.value === '__new__') {
                  void handleNewGroup()
                  return
                }
                setGroupId(e.currentTarget.value || null)
              }}
            >
              <option value="">Ungrouped</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value="__new__">+ New group…</option>
            </select>
          </label>

          <label className={fieldRow}>
            Tags
            <input
              className={inputCls}
              value={tagInput}
              onChange={(e) => setTagInput(e.currentTarget.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => addTag(tagInput)}
              placeholder="prod, db… (Enter to add)"
              list="tag-suggestions"
            />
            <datalist id="tag-suggestions">
              {allTags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </label>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-[6px]">
              {tags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className="cursor-pointer rounded-full border border-[var(--border-2)] bg-white/5 px-[10px] py-[3px] text-[11px] text-[var(--text)]"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                >
                  {tag} ✕
                </button>
              ))}
            </div>
          )}

          <div className={fieldRow}>
            <span>Terminal color (this host)</span>
            <SwatchDropdown value={termScheme} onChange={setTermScheme} options={TERM_OPTIONS} />
          </div>

          {error && <p className="text-[12px] text-[var(--red)]">{error}</p>}
        </div>

        <div className="flex justify-end gap-[10px] border-t border-[var(--border)] bg-black/20 px-5 py-[14px]">
          <button type="button" className={drawerBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={drawerBtnPrimary} style={{ boxShadow: '0 4px 16px color-mix(in srgb, var(--accent) 30%, transparent)' }} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

interface SwatchOption {
  value: string
  label: string
  swatch: ReactNode
}

const DEFAULT_SWATCH = (
  <span className="h-4 w-4 shrink-0 rounded-[5px]" style={{ background: 'linear-gradient(135deg,#3a3f4a,#262a33)' }} />
)

const TERM_OPTIONS: SwatchOption[] = [
  { value: '', label: 'Use global default', swatch: DEFAULT_SWATCH },
  ...Object.entries(TERM_SWATCH).map(([name, sw]) => ({
    value: name,
    label: name,
    swatch: (
      <span
        className="flex h-4 w-[22px] shrink-0 items-center justify-center rounded border border-white/[0.12] text-[9.5px]"
        style={{ background: sw.bg, color: sw.fg, fontFamily: 'var(--font-mono)' }}
      >
        Aa
      </span>
    ) as ReactNode,
  })),
]

function SwatchDropdown({
  value,
  onChange,
  options,
}: {
  value: string | null
  onChange: (v: string | null) => void
  options: SwatchOption[]
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
  const current = options.find((o) => o.value === (value ?? '')) ?? options[0]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-[9px] border border-[var(--border-2)] bg-[var(--bg-deep)] px-[11px] py-2 text-[12.5px] font-normal normal-case tracking-normal text-[var(--text)] hover:border-[var(--accent-border)]"
        onClick={() => setOpen((o) => !o)}
      >
        {current.swatch}
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{current.label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="ml-auto shrink-0 text-[var(--text-faint)]">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[340px] min-w-full animate-[rise_0.14s_ease_both] overflow-y-auto rounded-[11px] border border-[var(--border-2)] bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))] p-[6px]"
          style={{ boxShadow: '0 20px 50px -18px rgba(0,0,0,0.75)' }}
        >
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              className={`flex w-full cursor-pointer items-center gap-[9px] rounded-lg px-[10px] py-[9px] text-left normal-case tracking-normal ${o.value === (value ?? '') ? 'bg-[var(--accent-soft-2)]' : 'bg-transparent hover:bg-white/5'}`}
              onClick={() => {
                onChange(o.value || null)
                setOpen(false)
              }}
            >
              {o.swatch}
              <span className="text-[13px] font-medium text-[var(--text)]">{o.label}</span>
              {o.value === (value ?? '') && <span className="ml-auto shrink-0 text-[13px] text-[var(--accent)]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

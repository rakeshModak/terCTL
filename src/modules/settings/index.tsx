import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  bumpFontSizeAtom,
  setAccentAtom,
  setTermSchemeAtom,
  setThemeAtom,
  settingsAtom,
} from '../../store/settings'
import { ACCENTS } from '../../constants/accents'
import { THEMES, themeSwatch } from '../../constants/themes'
import { TERM_SWATCH } from '../../constants/terminal-schemes'
import {
  availableUpdateAtom,
  checkForUpdateAtom,
  updateErrorAtom,
  updateStatusAtom,
} from '../../store/updater'
import { appVersionAtom } from '../../store/version'

const CATS = [
  { id: 'appearance', name: 'Appearance' },
  { id: 'terminal', name: 'Terminal' },
  { id: 'security', name: 'Security' },
]

export function SettingsView() {
  const [cat, setCat] = useState('appearance')
  const { fontSize, accent, theme, termScheme } = useAtomValue(settingsAtom)
  const bumpFontSize = useSetAtom(bumpFontSizeAtom)
  const setAccent = useSetAtom(setAccentAtom)
  const setTheme = useSetAtom(setThemeAtom)
  const setTermScheme = useSetAtom(setTermSchemeAtom)
  const updateStatus = useAtomValue(updateStatusAtom)
  const availableUpdate = useAtomValue(availableUpdateAtom)
  const updateError = useAtomValue(updateErrorAtom)
  const appVersion = useAtomValue(appVersionAtom)
  const checkForUpdate = useSetAtom(checkForUpdateAtom)

  const updateLabel =
    updateStatus === 'checking'
      ? 'Checking for updates…'
      : updateStatus === 'uptodate'
        ? "You're on the latest version."
        : updateStatus === 'available'
          ? `Version ${availableUpdate?.version} is available — see the banner to install.`
          : updateStatus === 'error'
            ? `Couldn't check for updates: ${updateError}`
            : 'Keep TerCTL up to date.'

  return (
    <div className="flex min-w-0 flex-1 bg-[var(--bg)]">
      <div className="w-[210px] shrink-0 border-r border-[var(--border)] px-3 py-5">
        <h1 className="mx-[10px] mt-0 mb-4 text-base font-bold">Settings</h1>
        {CATS.map((c) => (
          <button
            key={c.id}
            className="mb-[2px] w-full cursor-pointer rounded-[9px] px-3 py-[9px] text-left text-[13px]"
            style={{
              background: c.id === cat ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: c.id === cat ? 'var(--text)' : 'var(--text-dim)',
              fontWeight: c.id === cat ? 600 : 500,
            }}
            onClick={() => setCat(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-[34px] py-7">
        {cat === 'appearance' && (
          <div className="max-w-[720px]">
            <h2 className="mt-0 mb-1 text-[20px] font-bold">Appearance</h2>
            <p className="mt-0 mb-6 text-[13px] text-[var(--text-muted)]">Themes, accent, and typography for the workspace.</p>

            <div className="mb-[11px] text-[12.5px] font-semibold text-[var(--text-bright)]">Theme</div>
            <div className="mb-[26px] flex flex-wrap gap-3">
              {Object.keys(THEMES).map((name) => {
                const active = name === theme
                return (
                  <div
                    key={name}
                    className="w-[150px] cursor-pointer overflow-hidden rounded-xl border-2 bg-[var(--bg-card)]"
                    style={{ borderColor: active ? 'var(--brand)' : 'rgba(255,255,255,0.08)' }}
                    onClick={() => setTheme(name)}
                  >
                    <div style={{ height: 64, background: themeSwatch(name) }} />
                    <div className="flex items-center gap-[7px] px-[11px] py-[9px]">
                      <span className="text-[12.5px] font-semibold" style={{ color: active ? 'var(--text)' : 'var(--text-dim)' }}>{name}</span>
                      <span className="ml-auto text-[13px]" style={{ color: active ? 'var(--brand)' : 'transparent' }}>✓</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mb-[11px] text-[12.5px] font-semibold text-[var(--text-bright)]">Accent color</div>
            <div className="mb-[26px] flex flex-wrap gap-3">
              {Object.entries(ACCENTS).map(([name, a]) => {
                const active = name === accent
                return (
                  <span
                    key={name}
                    title={name}
                    onClick={() => setAccent(name)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: `linear-gradient(135deg, ${a.c}, ${a.c2})`,
                      border: `2px solid ${active ? '#fff' : 'transparent'}`,
                      cursor: 'pointer',
                      boxShadow: active ? `0 0 12px ${a.c}` : 'none',
                    }}
                  />
                )
              })}
            </div>

            <div className="mb-[11px] text-[12.5px] font-semibold text-[var(--text-bright)]">Terminal text</div>
            <div className="mb-[26px] flex flex-wrap gap-[10px]">
              {Object.entries(TERM_SWATCH).map(([name, s]) => {
                const active = name === termScheme
                return (
                  <div
                    key={name}
                    title={name}
                    onClick={() => setTermScheme(name)}
                    className="flex h-[60px] w-[72px] cursor-pointer flex-col items-center justify-center gap-[3px] rounded-[10px] border-2"
                    style={{ background: s.bg, borderColor: active ? 'var(--brand)' : 'rgba(255,255,255,0.1)' }}
                  >
                    <span style={{ color: s.fg, fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700 }}>Aa</span>
                    <span style={{ color: s.fg, fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.8 }}>{name}</span>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col gap-[2px] rounded-[13px] border border-[var(--border)] bg-[var(--bg-card)] px-1 py-[6px]">
              <div className="flex items-center px-4 py-[13px]">
                <div className="flex-1">
                  <div className="text-[13px] font-medium">Interface font</div>
                  <div className="mt-[2px] text-[11.5px] text-[var(--text-faint)]">Used for panels and navigation</div>
                </div>
                <span className="rounded-lg bg-white/5 px-3 py-[6px] text-[12px] text-[var(--text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>Space Grotesk</span>
              </div>
              <div className="mx-4 h-px bg-white/5" />
              <div className="flex items-center px-4 py-[13px]">
                <div className="flex-1">
                  <div className="text-[13px] font-medium">Terminal font size</div>
                  <div className="mt-[2px] text-[11.5px] text-[var(--text-faint)]">Monospace size for terminals and logs</div>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-white/5 p-[2px]">
                  <button type="button" className="h-7 w-7 cursor-pointer rounded-md bg-transparent text-base leading-none text-[var(--text-dim)] hover:bg-white/[0.06] hover:text-[var(--text)]" onClick={() => bumpFontSize(-1)} aria-label="Decrease font size">−</button>
                  <span className="min-w-10 text-center text-[12px] text-[var(--text)]" style={{ fontFamily: 'var(--font-mono)' }}>{fontSize}px</span>
                  <button type="button" className="h-7 w-7 cursor-pointer rounded-md bg-transparent text-base leading-none text-[var(--text-dim)] hover:bg-white/[0.06] hover:text-[var(--text)]" onClick={() => bumpFontSize(1)} aria-label="Increase font size">+</button>
                </div>
              </div>
            </div>
            <p className="mt-[10px] text-[12px] text-[var(--text-faint)]">
              Changes apply instantly to all open terminals and persist across restarts.
            </p>
          </div>
        )}

        {cat === 'terminal' && (
          <div className="max-w-[720px]">
            <h2 className="mt-0 mb-1 text-[20px] font-bold">Terminal</h2>
            <p className="mt-0 mb-6 text-[13px] text-[var(--text-muted)]">Cursor, scrollback, and shell behavior.</p>
            <div className="mb-4 inline-block whitespace-nowrap rounded-lg border px-[11px] py-[5px] text-[11px] text-[var(--amber)]" style={{ background: 'rgba(245,181,68,0.1)', borderColor: 'rgba(245,181,68,0.22)' }}>More terminal options coming soon</div>
            <div className="flex flex-col gap-[2px] rounded-[13px] border border-[var(--border)] bg-[var(--bg-card)] px-1 py-[6px]">
              {['Cursor blink', 'Copy on select', 'Shell integration'].map((label, i) => (
                <div key={label}>
                  {i > 0 && <div className="mx-4 h-px bg-white/5" />}
                  <div className="flex items-center px-4 py-[13px]">
                    <div className="flex-1 text-[13px] font-medium">{label}</div>
                    <div className="flex h-6 w-[42px] cursor-pointer justify-end rounded-[14px] bg-[var(--brand)] p-[2px]" style={{ boxShadow: '0 0 12px color-mix(in srgb, var(--brand) 40%, transparent)' }}>
                      <span className="block h-5 w-5 rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cat === 'security' && (
          <div className="max-w-[720px]">
            <h2 className="mt-0 mb-1 text-[20px] font-bold">Security</h2>
            <p className="mt-0 mb-6 text-[13px] text-[var(--text-muted)]">Agent, host keys, and locking policy.</p>
            <div className="mb-5 flex items-center gap-3 rounded-xl border px-4 py-[13px]" style={{ background: 'rgba(245,181,68,0.08)', borderColor: 'rgba(245,181,68,0.25)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5b544" strokeWidth="2" strokeLinecap="round">
                <path d="M12 9v4M12 17h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
              </svg>
              <span className="text-[12.5px]" style={{ color: '#e8d3a8' }}>Credentials are stored in your OS keychain and never leave this device.</span>
            </div>
            <div className="flex flex-col gap-[2px] rounded-[13px] border border-[var(--border)] bg-[var(--bg-card)] px-1 py-[6px]">
              <div className="flex items-center px-4 py-[13px]">
                <div className="flex-1">
                  <div className="text-[13px] font-medium">Store passphrases in keychain</div>
                  <div className="mt-[2px] text-[11.5px] text-[var(--text-faint)]">Use system secure storage</div>
                </div>
                <div className="flex h-6 w-[42px] cursor-pointer justify-end rounded-[14px] bg-[var(--brand)] p-[2px]" style={{ boxShadow: '0 0 12px color-mix(in srgb, var(--brand) 40%, transparent)' }}>
                  <span className="block h-5 w-5 rounded-full bg-white" />
                </div>
              </div>
              <div className="mx-4 h-px bg-white/5" />
              <div className="flex items-center px-4 py-[13px]">
                <div className="flex-1">
                  <div className="text-[13px] font-medium">Host key policy</div>
                  <div className="mt-[2px] text-[11.5px] text-[var(--text-faint)]">Verification on connect (trust on first use)</div>
                </div>
                <span className="rounded-lg px-3 py-[6px] text-[12px] text-[var(--green)]" style={{ fontFamily: 'var(--font-mono)', background: 'rgba(61,220,151,0.12)' }}>TOFU</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 max-w-[720px] border-t border-[var(--border)] pt-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[13px] font-medium">
                Software update
                {appVersion && <span className="ml-2 font-normal text-[var(--text-faint)]" style={{ fontFamily: 'var(--font-mono)' }}>v{appVersion}</span>}
              </div>
              <div className="mt-[2px] text-[11.5px] text-[var(--text-faint)]">{updateLabel}</div>
            </div>
            <button
              className="cursor-pointer rounded-[9px] border border-[var(--border-2)] bg-white/[0.04] px-[14px] py-2 text-[12px] font-medium text-[var(--text)] hover:border-[var(--border-strong)] disabled:cursor-default disabled:opacity-60"
              disabled={updateStatus === 'checking'}
              onClick={() => checkForUpdate()}
            >
              {updateStatus === 'checking' ? 'Checking…' : 'Check for updates'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

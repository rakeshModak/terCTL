const KEYS = [
  { name: 'id_ed25519', type: 'ED25519', fp: 'SHA256:9xE2…kQ7', comment: 'deploy@acme', added: '2025-11-02', loaded: true },
  { name: 'acme_prod_rsa', type: 'RSA 4096', fp: 'SHA256:aT4…mN2', comment: 'ci@acme.io', added: '2025-06-18', loaded: true },
  { name: 'homelab_ed', type: 'ED25519', fp: 'SHA256:Kd9…pL0', comment: 'me@home', added: '2024-12-30', loaded: false },
]

// Static preview — the key/agent backend isn't wired yet.
export function KeysView() {
  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg)]">
      <div className="mx-auto max-w-[920px] px-8 py-[26px]">
        <div className="mb-[22px] flex items-end gap-3">
          <div>
            <h1 className="m-0 text-[26px] font-bold tracking-[-0.3px]">Keys &amp; Identity</h1>
            <p className="mt-[5px] mb-0 text-[13px] text-[var(--text-muted)]">3 keys · agent unlocked · 42 known hosts</p>
          </div>
          <div className="flex-1" />
          <span
            className="whitespace-nowrap rounded-lg border px-[11px] py-[5px] text-[11px] text-[var(--amber)]"
            style={{ background: 'rgba(245,181,68,0.1)', borderColor: 'rgba(245,181,68,0.22)' }}
          >
            Preview · key backend coming soon
          </span>
          <button className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-[10px] text-[13px] font-semibold text-[var(--accent)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff7a59" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Key
          </button>
        </div>

        <div
          className="mb-[22px] flex items-center gap-[14px] rounded-[13px] border px-[18px] py-[15px]"
          style={{
            background: 'linear-gradient(135deg,rgba(61,220,151,0.09),rgba(61,220,151,0.02))',
            borderColor: 'rgba(61,220,151,0.22)',
          }}
        >
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px]" style={{ background: 'rgba(61,220,151,0.15)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3ddc97" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">SSH agent is unlocked</div>
            <div className="mt-[2px] text-xs text-[var(--text-muted)]">
              Passphrases stored in system keychain · auto-locks after 15 min idle
            </div>
          </div>
          <button className="cursor-pointer rounded-[9px] border border-[var(--border-strong)] bg-transparent px-[14px] py-2 text-[12px] font-medium text-[var(--text-bright)]">
            Lock now
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {KEYS.map((k) => {
            const ed = k.type.startsWith('ED')
            const badgeBg = ed ? 'rgba(61,220,151,0.13)' : 'rgba(139,91,255,0.14)'
            const badgeColor = ed ? '#3ddc97' : '#a17fff'
            const loadColor = k.loaded ? '#3ddc97' : '#5f6875'
            return (
              <div
                key={k.name}
                className="flex items-center gap-4 rounded-[13px] border border-[var(--border-2)] bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))] px-[18px] py-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]" style={{ background: badgeBg }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={badgeColor} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 7a4 4 0 11-3.9 5H8l-1.5 1.5L5 12H3v-2l6-6a4 4 0 016 3z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-[9px]">
                    <span className="font-mono text-sm font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>{k.name}</span>
                    <span className="rounded-md px-2 py-[2px] text-[10px] font-semibold tracking-[0.4px]" style={{ background: badgeBg, color: badgeColor }}>
                      {k.type}
                    </span>
                  </div>
                  <div className="mt-1 text-[11.5px] text-[var(--text-faint)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {k.fp} · {k.comment}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-[6px] text-[11px] text-[var(--text-faint)]">added {k.added}</div>
                  <span className="inline-flex items-center gap-[6px] text-[11.5px]" style={{ color: loadColor }}>
                    <span className="h-[6px] w-[6px] rounded-full" style={{ background: loadColor }} />
                    {k.loaded ? 'in agent' : 'not loaded'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

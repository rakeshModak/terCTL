import { useAtomValue, useSetAtom } from 'jotai'
import {
  availableUpdateAtom,
  installUpdateAtom,
  updateDismissedAtom,
  updateProgressAtom,
  updateStatusAtom,
} from '../store/updater'

// Floating banner shown when a newer version is available (or downloading).
export function UpdateBanner() {
  const status = useAtomValue(updateStatusAtom)
  const update = useAtomValue(availableUpdateAtom)
  const progress = useAtomValue(updateProgressAtom)
  const dismissed = useAtomValue(updateDismissedAtom)
  const install = useSetAtom(installUpdateAtom)
  const setDismissed = useSetAtom(updateDismissedAtom)

  const downloading = status === 'downloading'
  if (!update || !((status === 'available' && !dismissed) || downloading)) return null

  return (
    <div
      className="fixed bottom-5 left-1/2 z-[120] flex w-[380px] max-w-[92vw] -translate-x-1/2 flex-col gap-[12px] rounded-[13px] border border-[var(--border-2)] bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))] p-[14px] animate-[rise_0.2s_ease_both]"
      style={{ boxShadow: '0 20px 50px -18px rgba(0,0,0,0.75)' }}
    >
      <div className="flex items-center gap-[10px]">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft-2)] text-[var(--brand)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v11M7 9l5 5 5-5M5 21h14" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[var(--text)]">Update available — v{update.version}</div>
          <div className="text-[11.5px] text-[var(--text-muted)]">
            {downloading ? `Downloading… ${progress}%` : 'A new version of TerCTL is ready to install.'}
          </div>
        </div>
        {!downloading && (
          <button
            className="shrink-0 cursor-pointer text-[12px] text-[var(--text-faint)] hover:text-[var(--text)]"
            onClick={() => setDismissed(true)}
          >
            Later
          </button>
        )}
      </div>
      {downloading ? (
        <div className="h-[4px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      ) : (
        <button
          className="cursor-pointer rounded-lg bg-[image:var(--gradient-brand)] px-4 py-2 text-[13px] font-bold text-[#1a0e0a]"
          onClick={() => install()}
        >
          Update &amp; restart
        </button>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  confirmReqAtom,
  promptReqAtom,
  resolveConfirmAtom,
  resolvePromptAtom,
} from '../store/dialog'

const overlay = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/55'
const cardSm =
  'relative flex max-h-[85vh] w-[380px] flex-col gap-[14px] overflow-y-auto rounded-[14px] border border-[var(--border-2)] bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))] p-[22px]'
const cardShadow = { boxShadow: '0 24px 60px -20px rgba(0,0,0,0.7)' } as const
const h2Cls =
  'm-0 break-words text-[15px] font-[650] leading-[1.4] tracking-normal text-[var(--text-bright)] [overflow-wrap:anywhere]'
const inputCls =
  'rounded-[9px] border border-[var(--border-2)] bg-[var(--bg-deep)] px-3 py-[10px] text-[13px] text-[var(--text)] transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-ring)] focus:outline-none'
const actionBtn =
  'cursor-pointer rounded-lg border border-[var(--border-2)] bg-white/[0.04] px-[14px] py-[7px] text-[13px] text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60'
const primaryBtn = `${actionBtn} border-none bg-[image:var(--gradient-accent)] font-bold text-[#1a0e0a]`
const dangerBtn = `${actionBtn} border-none bg-[var(--red)] font-bold text-[#2a0b0b]`

export function Dialogs() {
  const promptReq = useAtomValue(promptReqAtom)
  const confirmReq = useAtomValue(confirmReqAtom)
  const resolvePrompt = useSetAtom(resolvePromptAtom)
  const resolveConfirm = useSetAtom(resolveConfirmAtom)

  return (
    <>
      {promptReq && (
        <PromptDialog
          key={promptReq.title + promptReq.initialValue}
          title={promptReq.title}
          placeholder={promptReq.placeholder}
          initialValue={promptReq.initialValue}
          confirmLabel={promptReq.confirmLabel}
          onCancel={() => resolvePrompt(null)}
          onConfirm={(value) => resolvePrompt(value)}
        />
      )}
      {confirmReq && (
        <div className={overlay} onClick={() => resolveConfirm(false)}>
          <div
            className={cardSm}
            style={
              confirmReq.danger
                ? { ...cardShadow, borderColor: 'color-mix(in srgb, var(--red) 40%, var(--border-2))' }
                : cardShadow
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-[10px]">
              {confirmReq.danger && (
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[rgb(255_95_86_/_0.12)] text-[var(--red)]" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 9v4M12 17h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                  </svg>
                </span>
              )}
              <h2 className={h2Cls}>{confirmReq.title}</h2>
            </div>
            <p className="m-0 text-[13px] leading-[1.5] text-[var(--text-muted)]">{confirmReq.message}</p>
            <div className="mt-[6px] flex justify-end gap-2">
              <button type="button" className={actionBtn} onClick={() => resolveConfirm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={confirmReq.danger ? dangerBtn : primaryBtn}
                onClick={() => resolveConfirm(true)}
              >
                {confirmReq.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface PromptDialogProps {
  title: string
  placeholder: string
  initialValue: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: (value: string) => void
}

function PromptDialog({
  title,
  placeholder,
  initialValue,
  confirmLabel,
  onCancel,
  onConfirm,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue)
  const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!inputRef) return
    inputRef.focus()
    // Select the basename but keep the extension out of the selection, and
    // anchor the caret at the start ("backward") so the beginning of long
    // filenames stays visible instead of scrolling to the end.
    const val = inputRef.value
    const dot = val.lastIndexOf('.')
    const end = dot > 0 ? dot : val.length
    inputRef.setSelectionRange(0, end, 'backward')
    inputRef.scrollLeft = 0
  }, [inputRef])

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <div className={overlay} onClick={onCancel}>
      <form
        className={cardSm}
        style={cardShadow}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <h2 className={h2Cls}>{title}</h2>
        <input
          ref={setInputRef}
          className={inputCls}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
          }}
        />
        <div className="mt-[6px] flex justify-end gap-2">
          <button type="button" className={actionBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={primaryBtn}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

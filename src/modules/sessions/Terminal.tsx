import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { listen } from '@tauri-apps/api/event'
import { getDefaultStore, useAtomValue } from 'jotai'
import '@xterm/xterm/css/xterm.css'
import { terminalFontFamily, TERM_SCHEMES } from '../../constants/terminal-schemes'
import { settingsAtom } from '../../store/settings'
import { sshService } from '../../services/ssh.service'

interface TermOutputEvent {
  sessionId: string
  data: number[]
}

interface TermClosedEvent {
  sessionId: string
  error: string | null
}

interface TerminalProps {
  sessionId: string
  onClosed: (error: string | null) => void
  /** Per-host terminal color scheme override; falls back to the global setting. */
  scheme?: string | null
}

export function Terminal({ sessionId, onClosed, scheme }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Keep the latest onClosed without making it an effect dependency — otherwise
  // the effect re-runs on every parent render, disposing and recreating xterm
  // (losing all scrollback) even though the session is unchanged.
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const settings = useAtomValue(settingsAtom)
  const fontSize = settings.fontSize
  const globalScheme = settings.termScheme
  // Host override wins over the global scheme when set to a known scheme.
  const termScheme = scheme && TERM_SCHEMES[scheme] ? scheme : globalScheme

  useEffect(() => {
    const term = new XTerm({
      convertEol: true,
      fontFamily: terminalFontFamily,
      fontSize: getDefaultStore().get(settingsAtom).fontSize,
      theme: TERM_SCHEMES[termScheme] ?? TERM_SCHEMES.TerCTL,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    termRef.current = term
    fitRef.current = fitAddon

    // xterm renders blank if it was in a display:none container (e.g. while on
    // another view). Refit + repaint whenever it becomes visible/resized —
    // coalesced with rAF so the split-transition doesn't fire a fit storm.
    let rafId = 0
    let settleTimer: ReturnType<typeof setTimeout> | undefined
    const fitNow = () => {
      if (!containerRef.current || containerRef.current.offsetWidth === 0) return
      try {
        fitAddon.fit()
        term.refresh(0, term.rows - 1)
      } catch {
        /* container not ready */
      }
    }
    const repaint = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0
          fitNow()
        })
      }
      // Pane splits/resizes animate (~180ms); the rAF fits track the motion, but
      // one final fit after it settles guarantees the row count matches the final
      // pane height so the bottom row isn't left clipped.
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(fitNow, 240)
    }

    if (containerRef.current) {
      term.open(containerRef.current)
      fitAddon.fit()
      term.focus()
      // macOS spell-checks xterm's hidden input textarea as output streams,
      // spamming "NSSpellServer … timed out" logs. Turn it off.
      const helper = containerRef.current.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea')
      if (helper) {
        helper.spellcheck = false
        helper.setAttribute('autocorrect', 'off')
        helper.setAttribute('autocapitalize', 'off')
      }
    }

    const outputUnlisten = listen<TermOutputEvent>('term://output', (event) => {
      if (event.payload.sessionId !== sessionId) return
      term.write(new Uint8Array(event.payload.data))
    })

    const closedUnlisten = listen<TermClosedEvent>('term://closed', (event) => {
      if (event.payload.sessionId !== sessionId) return
      onClosedRef.current(event.payload.error)
    })

    const dataDisposable = term.onData((data) => {
      void sshService.sendInput(sessionId, Array.from(new TextEncoder().encode(data)))
    })

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      void sshService.resize(sessionId, cols, rows)
    })

    // The initial fit() above ran before this onResize handler existed, so its
    // resize event was dropped and the remote PTY stayed at the 80x24 default —
    // full-screen TUIs (nano/vim/top) then draw into a too-short area, leaving a
    // blank gap. Push the real fitted size to the backend now.
    void sshService.resize(sessionId, term.cols, term.rows)

    const resizeObserver = new ResizeObserver(() => repaint())
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) repaint()
      },
      { threshold: 0.01 },
    )
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
      intersectionObserver.observe(containerRef.current)
    }
    window.addEventListener('resize', repaint)

    return () => {
      // Only tear down the UI here — never the backend session. The SSH/PTY
      // session lives independently (Termius model); it's closed explicitly
      // via closeSession (tab ✕ / Disconnect), not when this view unmounts.
      if (rafId) cancelAnimationFrame(rafId)
      if (settleTimer) clearTimeout(settleTimer)
      window.removeEventListener('resize', repaint)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      dataDisposable.dispose()
      resizeDisposable.dispose()
      void outputUnlisten.then((unlisten) => unlisten())
      void closedUnlisten.then((unlisten) => unlisten())
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [sessionId])

  // Live-update the font size from Settings without recreating the terminal.
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontSize = fontSize
    fitRef.current?.fit()
  }, [fontSize])

  // Live-update the color scheme (terminal text/cursor) from Settings.
  useEffect(() => {
    const nextScheme = TERM_SCHEMES[termScheme] ?? TERM_SCHEMES.TerCTL
    // Expose the scheme background so split-pane containers can match it and the
    // rounded corners blend seamlessly with the terminal.
    if (nextScheme.background) {
      document.documentElement.style.setProperty('--term-bg', nextScheme.background)
    }
    const term = termRef.current
    if (!term) return
    term.options.theme = nextScheme
    term.refresh(0, term.rows - 1)
  }, [termScheme])

  // Pinned to the pane edges via absolute offsets (never padding/height:100%).
  // The spacing lives in the inset offsets — NOT container padding — because the
  // fit-addon measures this element to compute rows, and WebKit mis-reports a
  // padded border-box height, over-counting by a row that then clips at the
  // bottom. Offsets give the same 6/4/4/8 gap with a clean, padding-free box.
  return <div ref={containerRef} className="absolute left-[8px] right-[4px] top-[6px] bottom-[4px]" />
}

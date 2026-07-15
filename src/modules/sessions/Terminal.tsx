import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { listen } from '@tauri-apps/api/event'
import { getDefaultStore, useAtomValue } from 'jotai'
import '@xterm/xterm/css/xterm.css'
import { terminalFontFamily, TERM_SCHEMES } from '../../constants/terminal-schemes'
import { settingsAtom } from '../../store/settings'
import { sshService } from '../../services/ssh.service'
import { IS_MAC } from '../../lib/platform'
import { Search, ChevronUp, ChevronDown, X, CaseSensitive, Regex } from 'lucide-react'

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

const FIND_ICON_BTN =
  'flex h-[24px] w-[24px] shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--text-dim)] transition-colors hover:bg-white/10 hover:text-[var(--text)]'
const findToggle = (on: boolean) =>
  `flex h-[24px] w-[26px] shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors ${
    on
      ? 'bg-[var(--accent)] text-[#0b0d10] shadow-[0_1px_4px_rgb(0_0_0_/_0.3)]'
      : 'text-[var(--text-faint)] hover:bg-white/10 hover:text-[var(--text)]'
  }`

export function Terminal({ sessionId, onClosed, scheme }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Keep the latest onClosed without making it an effect dependency — otherwise
  // the effect re-runs on every parent render, disposing and recreating xterm
  // (losing all scrollback) even though the session is unchanged.
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  // Match positions (absolute buffer row/col/length), rescanned as the query or
  // buffer changes; drives both the counter and next/prev navigation.
  const matchesRef = useRef<{ row: number; col: number; length: number }[]>([])
  // Live xterm decorations painting every match; disposed/rebuilt on each render.
  const highlightsRef = useRef<Array<{ dispose(): void }>>([])
  const findInputRef = useRef<HTMLInputElement | null>(null)
  // Find-in-terminal (⌘F / Ctrl+Shift+F) — searches the xterm scrollback buffer.
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  // The match count is computed from the buffer ourselves (see countMatches). The
  // addon's own counter is unreliable on a live-streaming log — each incoming write
  // resets its result set — so we don't trust its onDidChangeResults for the count.
  const [matchCount, setMatchCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
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
      // Required for the find-match decorations (registerMarker/registerDecoration).
      allowProposedApi: true,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    termRef.current = term
    fitRef.current = fitAddon

    // Re-scan matches as new output streams in, so the counter stays live while
    // logs scroll. Debounced; only active while the find bar is open with a query.
    let recountTimer: ReturnType<typeof setTimeout> | undefined
    const writeParsedDisposable = term.onWriteParsed(() => {
      if (!findOpenRef.current || !findQueryRef.current) return
      if (recountTimer) clearTimeout(recountTimer)
      recountTimer = setTimeout(() => {
        const matches = scanMatchesRef.current(findQueryRef.current)
        matchesRef.current = matches
        setMatchCount(matches.length)
        const clamped = matches.length ? Math.min(activeIndexRef.current, matches.length - 1) : 0
        setActiveIndex(clamped)
        renderHighlightsRef.current(clamped)
      }, 150)
    })
    // Open the find bar on the platform's find shortcut. On macOS ⌘F is free;
    // on Win/Linux Ctrl+F is a live terminal control code, so use Ctrl+Shift+F.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      const findCombo = IS_MAC ? e.metaKey && !e.ctrlKey && !e.altKey : e.ctrlKey && e.shiftKey
      if (findCombo && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        // Prefill from a single-line terminal selection, if any (⌘F on selected text).
        const sel = term.getSelection().trim()
        if (sel && !sel.includes('\n')) setFindQuery(sel)
        setFindOpen(true)
        requestAnimationFrame(() => findInputRef.current?.select())
        return false
      }
      return true
    })

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
      if (recountTimer) clearTimeout(recountTimer)
      writeParsedDisposable.dispose()
      for (const d of highlightsRef.current) d.dispose()
      highlightsRef.current = []
      term.dispose()
      termRef.current = null
      fitRef.current = null
      matchesRef.current = []
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

  // Scan the buffer for every match of the query, returning absolute
  // {row, col, length} positions. Source of truth for both the counter and
  // navigation — fully independent of the (streaming-unreliable) search addon.
  const scanMatches = useCallback(
    (q: string): { row: number; col: number; length: number }[] => {
      const term = termRef.current
      if (!term || !q) return []
      let matcher: RegExp
      try {
        const pattern = useRegex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        matcher = new RegExp(pattern, caseSensitive ? 'g' : 'gi')
      } catch {
        return [] // incomplete regex while typing
      }
      const buf = term.buffer.active
      const out: { row: number; col: number; length: number }[] = []
      for (let i = 0; i < buf.length; i++) {
        const line = buf.getLine(i)
        if (!line) continue
        const text = line.translateToString(true)
        matcher.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = matcher.exec(text)) !== null) {
          out.push({ row: i, col: m.index, length: m[0].length || 1 })
          if (m[0].length === 0) matcher.lastIndex++ // guard zero-width regex loops
        }
      }
      return out
    },
    [useRegex, caseSensitive],
  )

  // Select + scroll the terminal to the match at idx (wraps). Mirrors the addon's
  // own centering math: only scroll when the match is off-screen.
  const goToMatch = useCallback((idx: number) => {
    const term = termRef.current
    const matches = matchesRef.current
    if (!term || matches.length === 0) return
    const n = matches.length
    const m = matches[((idx % n) + n) % n]
    term.select(m.col, m.row, m.length)
    const vpTop = term.buffer.active.viewportY
    if (m.row < vpTop || m.row >= vpTop + term.rows) {
      term.scrollLines(m.row - vpTop - Math.floor(term.rows / 2))
    }
  }, [])

  const clearHighlights = useCallback(() => {
    for (const d of highlightsRef.current) d.dispose()
    highlightsRef.current = []
  }, [])

  // Paint a colored decoration over every match — dim amber for all, bright accent
  // for the active one — so matches stand out far more than the selection alone.
  const renderHighlights = useCallback(
    (activeIdx: number) => {
      const term = termRef.current
      clearHighlights()
      const matches = matchesRef.current
      if (!term || matches.length === 0) return
      const accent =
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d9795f'
      const buf = term.buffer.active
      const cursorAbs = buf.baseY + buf.cursorY
      const n = matches.length
      const active = ((activeIdx % n) + n) % n
      const limit = Math.min(n, 1000) // cap decoration count on huge result sets
      for (let k = 0; k < limit; k++) {
        const m = matches[k]
        const marker = term.registerMarker(m.row - cursorAbs)
        if (!marker) continue
        const decoration = term.registerDecoration({
          marker,
          x: m.col,
          width: m.length,
          backgroundColor: k === active ? accent : '#6b5a2e',
          foregroundColor: '#0b0d10',
          layer: 'top',
        })
        highlightsRef.current.push(marker)
        if (decoration) highlightsRef.current.push(decoration)
      }
    },
    [clearHighlights],
  )

  // Refs so the mount-time onWriteParsed handler reads the latest find state and
  // scan/highlight fns without re-subscribing on every keystroke.
  const findOpenRef = useRef(findOpen)
  findOpenRef.current = findOpen
  const findQueryRef = useRef(findQuery)
  findQueryRef.current = findQuery
  const scanMatchesRef = useRef(scanMatches)
  scanMatchesRef.current = scanMatches
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const renderHighlightsRef = useRef(renderHighlights)
  renderHighlightsRef.current = renderHighlights

  // Rescan and jump to the first match as the query or flags change; clear when emptied.
  useEffect(() => {
    if (!findOpen) return
    if (!findQuery) {
      matchesRef.current = []
      clearHighlights()
      termRef.current?.clearSelection()
      setMatchCount(0)
      setActiveIndex(0)
      return
    }
    const matches = scanMatches(findQuery)
    matchesRef.current = matches
    setMatchCount(matches.length)
    setActiveIndex(0)
    renderHighlights(0)
    if (matches.length) goToMatch(0)
  }, [findQuery, findOpen, scanMatches, goToMatch, renderHighlights, clearHighlights])

  const findNext = useCallback(() => {
    const n = matchesRef.current.length
    if (!n) return
    const next = (activeIndexRef.current + 1) % n
    setActiveIndex(next)
    goToMatch(next)
    renderHighlights(next)
  }, [goToMatch, renderHighlights])

  const findPrev = useCallback(() => {
    const n = matchesRef.current.length
    if (!n) return
    const next = (activeIndexRef.current - 1 + n) % n
    setActiveIndex(next)
    goToMatch(next)
    renderHighlights(next)
  }, [goToMatch, renderHighlights])

  const closeFind = useCallback(() => {
    setFindOpen(false)
    clearHighlights()
    termRef.current?.clearSelection()
    termRef.current?.focus()
  }, [clearHighlights])

  return (
    <>
      {findOpen && (
        <div className="absolute right-[14px] top-[10px] z-30 flex items-center gap-[6px] rounded-[12px] border border-white/10 bg-[color-mix(in_srgb,var(--bg-card)_84%,transparent)] py-[6px] pl-[10px] pr-[7px] shadow-[0_10px_34px_rgb(0_0_0_/_0.5)] backdrop-blur-md">
          <Search size={14} strokeWidth={2.2} className="shrink-0 text-[var(--text-faint)]" />
          <input
            ref={findInputRef}
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (e.shiftKey) findPrev()
                else findNext()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                closeFind()
              }
            }}
            placeholder="Find in terminal"
            type="text"
            name="terctl-find"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-[156px] bg-transparent text-[12.5px] text-[var(--text)] no-underline [text-decoration:none] outline-none placeholder:text-[var(--text-faint)]"
          />
          <span
            className={`min-w-[46px] shrink-0 text-right text-[11px] tabular-nums ${
              findQuery && matchCount === 0 ? 'text-[var(--red)]' : 'text-[var(--text-faint)]'
            }`}
          >
            {findQuery ? (matchCount === 0 ? '0/0' : `${activeIndex + 1}/${matchCount}`) : ''}
          </span>
          <span className="h-[18px] w-px shrink-0 bg-white/10" />
          <button
            type="button"
            title="Match case"
            aria-pressed={caseSensitive}
            onClick={() => setCaseSensitive((v) => !v)}
            className={findToggle(caseSensitive)}
          >
            <CaseSensitive size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Use regular expression"
            aria-pressed={useRegex}
            onClick={() => setUseRegex((v) => !v)}
            className={findToggle(useRegex)}
          >
            <Regex size={14} strokeWidth={2} />
          </button>
          <span className="h-[18px] w-px shrink-0 bg-white/10" />
          <button type="button" title="Previous match  (⇧⏎)" onClick={findPrev} className={FIND_ICON_BTN}>
            <ChevronUp size={16} strokeWidth={2.4} />
          </button>
          <button type="button" title="Next match  (⏎)" onClick={findNext} className={FIND_ICON_BTN}>
            <ChevronDown size={16} strokeWidth={2.4} />
          </button>
          <button type="button" title="Close  (Esc)" onClick={closeFind} className={FIND_ICON_BTN}>
            <X size={15} strokeWidth={2.4} />
          </button>
        </div>
      )}
      {/* Pinned to the pane edges via absolute offsets (never padding/height:100%).
          The spacing lives in the inset offsets — NOT container padding — because
          the fit-addon measures this element to compute rows, and WebKit mis-reports
          a padded border-box height, over-counting by a row that then clips at the
          bottom. Offsets give the same 6/4/4/8 gap with a clean, padding-free box. */}
      <div ref={containerRef} className="absolute left-[8px] right-[4px] top-[6px] bottom-[4px]" />
    </>
  )
}

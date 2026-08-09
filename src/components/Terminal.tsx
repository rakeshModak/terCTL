import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { getDefaultStore, useAtomValue } from 'jotai';
import '@xterm/xterm/css/xterm.css';
import {
  hasTermScheme,
  terminalFontFamily,
  termTheme,
} from '../constants/terminal-schemes';
import { useResolvedMode } from '../hooks/useResolvedMode';
import { settingsAtom } from '../store/settings';
import { sshService } from '../services/ssh.service';
import { IS_MAC } from '../lib/platform';
import { readableOn } from '../lib/color';
import { readClipboard, writeClipboard } from '../lib/clipboard';
import {
  Search,
  ChevronUp,
  ChevronDown,
  X,
  CaseSensitive,
  Regex,
} from 'lucide-react';

interface TermOutputEvent {
  sessionId: string;
  data: number[];
}

interface TermClosedEvent {
  sessionId: string;
  error: string | null;
}

interface TerminalProps {
  sessionId: string;
  onClosed: (error: string | null) => void;
  scheme?: string | null;
}

const FIND_ICON_BTN =
  'flex h-[24px] w-[24px] shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--text-dim)] transition-colors hover:bg-foreground/10 hover:text-[var(--text)]';
const findToggle = (on: boolean) =>
  `flex h-[24px] w-[26px] shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors ${
    on
      ? 'bg-[var(--brand)] text-[var(--brand-contrast)] shadow-[0_1px_4px_rgb(0_0_0_/_0.3)]'
      : 'text-[var(--text-faint)] hover:bg-foreground/10 hover:text-[var(--text)]'
  }`;

function handleClipboardChord(term: XTerm, e: KeyboardEvent): boolean {
  if (IS_MAC || !e.ctrlKey || e.altKey || e.metaKey) return false;
  const key = e.key.toLowerCase();

  if (key === 'v' && e.shiftKey) {
    e.preventDefault();
    void readClipboard().then((text) => {
      if (text) term.paste(text);
    });
    return true;
  }

  if (key !== 'c') return false;
  const selection = term.getSelection();
  if (!selection && !e.shiftKey) return false;

  e.preventDefault();
  if (selection) {
    void writeClipboard(selection);
    term.clearSelection();
  }
  return true;
}

export function Terminal({ sessionId, onClosed, scheme }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const matchesRef = useRef<{ row: number; col: number; length: number }[]>([]);
  const highlightsRef = useRef<Array<{ dispose(): void }>>([]);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const settings = useAtomValue(settingsAtom);
  const fontSize = settings.fontSize;
  const globalScheme = settings.termScheme;
  const termScheme = hasTermScheme(scheme) ? scheme : globalScheme;
  const mode = useResolvedMode();

  useEffect(() => {
    const term = new XTerm({
      convertEol: true,
      fontFamily: terminalFontFamily,
      fontSize: getDefaultStore().get(settingsAtom).fontSize,
      theme: termTheme(termScheme, mode),
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    termRef.current = term;
    fitRef.current = fitAddon;

    let recountTimer: ReturnType<typeof setTimeout> | undefined;
    const writeParsedDisposable = term.onWriteParsed(() => {
      if (!findOpenRef.current || !findQueryRef.current) return;
      if (recountTimer) clearTimeout(recountTimer);
      recountTimer = setTimeout(() => {
        const matches = scanMatchesRef.current(findQueryRef.current);
        matchesRef.current = matches;
        setMatchCount(matches.length);
        const clamped = matches.length
          ? Math.min(activeIndexRef.current, matches.length - 1)
          : 0;
        setActiveIndex(clamped);
        renderHighlightsRef.current(clamped);
      }, 150);
    });
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;

      if (handleClipboardChord(term, e)) return false;

      const findCombo = IS_MAC
        ? e.metaKey && !e.ctrlKey && !e.altKey
        : e.ctrlKey && e.shiftKey;
      if (findCombo && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        const sel = term.getSelection().trim();
        if (sel && !sel.includes('\n')) setFindQuery(sel);
        setFindOpen(true);
        requestAnimationFrame(() => findInputRef.current?.select());
        return false;
      }
      return true;
    });

    let rafId = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const fitNow = () => {
      if (!containerRef.current || containerRef.current.offsetWidth === 0)
        return;
      try {
        fitAddon.fit();
        term.refresh(0, term.rows - 1);
      } catch {
        /* container not ready */
      }
    };
    const repaint = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          fitNow();
        });
      }
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(fitNow, 240);
    };

    if (containerRef.current) {
      term.open(containerRef.current);
      fitAddon.fit();
      term.focus();
      const helper = containerRef.current.querySelector<HTMLTextAreaElement>(
        '.xterm-helper-textarea',
      );
      if (helper) {
        helper.spellcheck = false;
        helper.setAttribute('autocorrect', 'off');
        helper.setAttribute('autocapitalize', 'off');
      }
    }

    const outputUnlisten = listen<TermOutputEvent>('term://output', (event) => {
      if (event.payload.sessionId !== sessionId) return;
      term.write(new Uint8Array(event.payload.data));
    });

    const closedUnlisten = listen<TermClosedEvent>('term://closed', (event) => {
      if (event.payload.sessionId !== sessionId) return;
      onClosedRef.current(event.payload.error);
    });

    const dataDisposable = term.onData((data) => {
      void sshService.sendInput(
        sessionId,
        Array.from(new TextEncoder().encode(data)),
      );
    });

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      void sshService.resize(sessionId, cols, rows);
    });

    void sshService.resize(sessionId, term.cols, term.rows);

    const resizeObserver = new ResizeObserver(() => repaint());
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) repaint();
      },
      { threshold: 0.01 },
    );
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      intersectionObserver.observe(containerRef.current);
    }
    window.addEventListener('resize', repaint);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (settleTimer) clearTimeout(settleTimer);
      window.removeEventListener('resize', repaint);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      void outputUnlisten.then((unlisten) => unlisten());
      void closedUnlisten.then((unlisten) => unlisten());
      if (recountTimer) clearTimeout(recountTimer);
      writeParsedDisposable.dispose();
      for (const d of highlightsRef.current) d.dispose();
      highlightsRef.current = [];
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      matchesRef.current = [];
    };
  }, [sessionId]);

  // Live-update the font size from Settings without recreating the terminal.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    fitRef.current?.fit();
  }, [fontSize]);

  useEffect(() => {
    const nextScheme = termTheme(termScheme, mode);
    if (nextScheme.background) {
      document.documentElement.style.setProperty(
        '--term-bg',
        nextScheme.background,
      );
    }
    const term = termRef.current;
    if (!term) return;
    term.options.theme = nextScheme;
    term.refresh(0, term.rows - 1);
  }, [termScheme, mode]);

  const scanMatches = useCallback(
    (q: string): { row: number; col: number; length: number }[] => {
      const term = termRef.current;
      if (!term || !q) return [];
      let matcher: RegExp;
      try {
        const pattern = useRegex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        matcher = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      } catch {
        return []; // incomplete regex while typing
      }
      const buf = term.buffer.active;
      const out: { row: number; col: number; length: number }[] = [];
      for (let i = 0; i < buf.length; i++) {
        const line = buf.getLine(i);
        if (!line) continue;
        const text = line.translateToString(true);
        matcher.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = matcher.exec(text)) !== null) {
          out.push({ row: i, col: m.index, length: m[0].length || 1 });
          if (m[0].length === 0) matcher.lastIndex++; // guard zero-width regex loops
        }
      }
      return out;
    },
    [useRegex, caseSensitive],
  );

  const goToMatch = useCallback((idx: number) => {
    const term = termRef.current;
    const matches = matchesRef.current;
    if (!term || matches.length === 0) return;
    const n = matches.length;
    const m = matches[((idx % n) + n) % n];
    term.select(m.col, m.row, m.length);
    const vpTop = term.buffer.active.viewportY;
    if (m.row < vpTop || m.row >= vpTop + term.rows) {
      term.scrollLines(m.row - vpTop - Math.floor(term.rows / 2));
    }
  }, []);

  const clearHighlights = useCallback(() => {
    for (const d of highlightsRef.current) d.dispose();
    highlightsRef.current = [];
  }, []);

  const renderHighlights = useCallback(
    (activeIdx: number) => {
      const term = termRef.current;
      clearHighlights();
      const matches = matchesRef.current;
      if (!term || matches.length === 0) return;
      const accent =
        getComputedStyle(document.documentElement)
          .getPropertyValue('--brand')
          .trim() || '#d9795f';
      // Non-active matches borrow the scheme's own yellow so the highlight
      // sits on the terminal's canvas rather than assuming a dark one, and
      // each fill picks whichever ink actually reads on top of it.
      const theme = termTheme(termScheme, mode);
      const idle = theme.yellow ?? '#6b5a2e';
      const inkOn = (bg: string) => readableOn(bg, '#0b0d10', '#ffffff');
      const buf = term.buffer.active;
      const cursorAbs = buf.baseY + buf.cursorY;
      const n = matches.length;
      const active = ((activeIdx % n) + n) % n;
      const limit = Math.min(n, 1000); // cap decoration count on huge result sets
      for (let k = 0; k < limit; k++) {
        const m = matches[k];
        const marker = term.registerMarker(m.row - cursorAbs);
        if (!marker) continue;
        const fill = k === active ? accent : idle;
        const decoration = term.registerDecoration({
          marker,
          x: m.col,
          width: m.length,
          backgroundColor: fill,
          foregroundColor: inkOn(fill),
          layer: 'top',
        });
        highlightsRef.current.push(marker);
        if (decoration) highlightsRef.current.push(decoration);
      }
    },
    [clearHighlights, termScheme, mode],
  );

  const findOpenRef = useRef(findOpen);
  findOpenRef.current = findOpen;
  const findQueryRef = useRef(findQuery);
  findQueryRef.current = findQuery;
  const scanMatchesRef = useRef(scanMatches);
  scanMatchesRef.current = scanMatches;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const renderHighlightsRef = useRef(renderHighlights);
  renderHighlightsRef.current = renderHighlights;

  // Rescan and jump to the first match as the query or flags change; clear when emptied.
  useEffect(() => {
    if (!findOpen) return;
    if (!findQuery) {
      matchesRef.current = [];
      clearHighlights();
      termRef.current?.clearSelection();
      setMatchCount(0);
      setActiveIndex(0);
      return;
    }
    const matches = scanMatches(findQuery);
    matchesRef.current = matches;
    setMatchCount(matches.length);
    setActiveIndex(0);
    renderHighlights(0);
    if (matches.length) goToMatch(0);
  }, [
    findQuery,
    findOpen,
    scanMatches,
    goToMatch,
    renderHighlights,
    clearHighlights,
  ]);

  const findNext = useCallback(() => {
    const n = matchesRef.current.length;
    if (!n) return;
    const next = (activeIndexRef.current + 1) % n;
    setActiveIndex(next);
    goToMatch(next);
    renderHighlights(next);
  }, [goToMatch, renderHighlights]);

  const findPrev = useCallback(() => {
    const n = matchesRef.current.length;
    if (!n) return;
    const next = (activeIndexRef.current - 1 + n) % n;
    setActiveIndex(next);
    goToMatch(next);
    renderHighlights(next);
  }, [goToMatch, renderHighlights]);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    clearHighlights();
    termRef.current?.clearSelection();
    termRef.current?.focus();
  }, [clearHighlights]);

  return (
    <>
      {findOpen && (
        <div className="border-foreground/10 absolute top-[10px] right-[14px] z-30 flex items-center gap-[6px] rounded-[12px] border bg-[color-mix(in_srgb,var(--bg-card)_84%,transparent)] py-[6px] pr-[7px] pl-[10px] shadow-[0_10px_34px_rgb(0_0_0_/_0.5)] backdrop-blur-md">
          <Search
            size={14}
            strokeWidth={2.2}
            className="shrink-0 text-[var(--text-faint)]"
          />
          <input
            ref={findInputRef}
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) findPrev();
                else findNext();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                closeFind();
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
            className="w-[156px] bg-transparent text-[12.5px] text-[var(--text)] no-underline outline-none [text-decoration:none] placeholder:text-[var(--text-faint)]"
          />
          <span
            className={`min-w-[46px] shrink-0 text-right text-[11px] tabular-nums ${
              findQuery && matchCount === 0
                ? 'text-[var(--red)]'
                : 'text-[var(--text-faint)]'
            }`}
          >
            {findQuery
              ? matchCount === 0
                ? '0/0'
                : `${activeIndex + 1}/${matchCount}`
              : ''}
          </span>
          <span className="bg-foreground/10 h-[18px] w-px shrink-0" />
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
          <span className="bg-foreground/10 h-[18px] w-px shrink-0" />
          <button
            type="button"
            title="Previous match  (⇧⏎)"
            onClick={findPrev}
            className={FIND_ICON_BTN}
          >
            <ChevronUp size={16} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            title="Next match  (⏎)"
            onClick={findNext}
            className={FIND_ICON_BTN}
          >
            <ChevronDown size={16} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            title="Close  (Esc)"
            onClick={closeFind}
            className={FIND_ICON_BTN}
          >
            <X size={15} strokeWidth={2.4} />
          </button>
        </div>
      )}
      {/* Pinned to the pane edges via absolute offsets (never padding/height:100%).
          The spacing lives in the inset offsets — NOT container padding — because
          the fit-addon measures this element to compute rows, and WebKit mis-reports
          a padded border-box height, over-counting by a row that then clips at the
          bottom. Offsets give the same 6/4/4/8 gap with a clean, padding-free box. */}
      <div
        ref={containerRef}
        className="absolute top-[6px] right-[4px] bottom-[4px] left-[8px]"
      />
    </>
  );
}

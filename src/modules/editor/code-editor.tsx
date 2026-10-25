import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
} from '@codemirror/language';
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from '@codemirror/search';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { useResolvedMode } from '@/hooks/useResolvedMode';
import { debugLog } from '@/lib/debugLog';
import { editorTheme, loadLanguage } from '@/lib/editor';
import { languageForFile } from '@/lib/language';
import { languageServerFor } from '@/lib/lsp';
import { themeTokens } from '@/lib/theme';
import { FONT_SIZE_MAX, FONT_SIZE_MIN, settingsAtom } from '@/store/settings';
import {
  activeBufferAtom,
  buffersAtom,
  editorFontSize,
  editorHostIdAtom,
  editorRootAtom,
  editorZoomAtom,
  saveBufferAtom,
  setDraftAtom,
} from '@/store/editor';

const WHEEL_ZOOM_STEP = 40;

// Compartments are keys, not state: one pair is shared by every document so a
// theme change can be dispatched at whichever one is on screen.
const themeSlot = new Compartment();
const languageSlot = new Compartment();
// Kept apart from the grammar on purpose: a language server that is missing,
// slow or broken must never be able to leave a file unhighlighted.
const lspSlot = new Compartment();

/** Everything that does not depend on the file, the theme or the language. */
const baseSetup: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  rectangularSelection(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  search({ top: true }),
  indentUnit.of('  '),
  EditorState.tabSize.of(2),
];

export default function CodeEditor() {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  /** One state per open file, so undo history and the caret survive a tab switch. */
  const states = useRef(new Map<string, EditorState>());
  /** Which language each file already has loaded, so it is fetched once. */
  const applied = useRef(new Map<string, string>());
  /** The file currently on screen — the only reliable handle on "still wanted". */
  const activePath = useRef<string | null>(null);
  /** Files already handed to a language server, so each is opened once. */
  const lspAttached = useRef(new Set<string>());
  const themeRef = useRef<Extension>([]);
  const saveActive = useRef<() => void>(() => {});
  const zoomBy = useRef<(delta: number) => void>(() => {});
  const setDraftRef = useRef<(path: string, draft: string) => void>(() => {});

  const buffer = useAtomValue(activeBufferAtom);
  const buffers = useAtomValue(buffersAtom);
  const hostId = useAtomValue(editorHostIdAtom);
  const root = useAtomValue(editorRootAtom);
  const { accent, theme, fontSize } = useAtomValue(settingsAtom);
  const zoom = useAtomValue(editorZoomAtom);
  const mode = useResolvedMode();
  const setZoom = useSetAtom(editorZoomAtom);
  const setDraft = useSetAtom(setDraftAtom);
  const save = useSetAtom(saveBufferAtom);

  const path = buffer?.path ?? null;
  const name = buffer?.name ?? null;
  const draft = buffer?.draft ?? null;
  const effectiveSize = editorFontSize(fontSize, zoom);

  useEffect(() => {
    saveActive.current = () => {
      if (path) void save(path);
    };
  }, [path, save]);

  useEffect(() => {
    setDraftRef.current = setDraft;
  }, [setDraft]);

  useEffect(() => {
    zoomBy.current = (delta) => {
      if (delta === 0) {
        setZoom(0);
        return;
      }
      const next = Math.min(
        FONT_SIZE_MAX - fontSize,
        Math.max(FONT_SIZE_MIN - fontSize, zoom + delta),
      );
      setZoom(next);
    };
  }, [zoom, fontSize, setZoom]);

  useEffect(() => {
    if (!host.current) return;

    const view = new EditorView({ parent: host.current });
    viewRef.current = view;

    const node = host.current;
    let travel = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      travel += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(travel) < WHEEL_ZOOM_STEP) return;
      const direction = travel > 0 ? -1 : 1;
      travel = 0;
      zoomBy.current(direction);
    };
    node.addEventListener('wheel', onWheel, { passive: false });

    const opened = states.current;
    const loaded = applied.current;
    const attached = lspAttached.current;
    return () => {
      node.removeEventListener('wheel', onWheel);
      view.destroy();
      opened.clear();
      loaded.clear();
      attached.clear();
      activePath.current = null;
      viewRef.current = null;
    };
  }, []);

  // Rebuilt whenever the palette or the text size moves, then pushed into
  // whichever document is on screen; the rest pick it up as they are shown.
  useEffect(() => {
    const next = editorTheme(
      themeTokens({ accent, theme, mode }),
      mode === 'dark',
      effectiveSize,
    );
    themeRef.current = next;
    viewRef.current?.dispatch({ effects: themeSlot.reconfigure(next) });
  }, [accent, theme, mode, effectiveSize]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (!path || name === null || draft === null) {
      const leaving = activePath.current;
      if (leaving) states.current.set(leaving, view.state);
      activePath.current = null;
      view.setState(EditorState.create({ extensions: [baseSetup] }));
      return;
    }

    // Stash whatever was on screen so its history and caret come back intact.
    // Keyed by the path we know was showing, never by comparing state objects:
    // every edit and every reconfigure replaces the state, so an identity
    // check against the stored copy is stale the moment it is stored.
    const leaving = activePath.current;
    if (leaving && leaving !== path) states.current.set(leaving, view.state);

    let next = states.current.get(path);
    if (!next) {
      next = EditorState.create({
        doc: draft,
        extensions: [
          baseSetup,
          themeSlot.of(themeRef.current),
          languageSlot.of([]),
          lspSlot.of([]),
          keymap.of([
            { key: 'Mod-s', run: () => (saveActive.current(), true) },
            { key: 'Mod-=', run: () => (zoomBy.current(1), true) },
            { key: 'Mod--', run: () => (zoomBy.current(-1), true) },
            { key: 'Mod-0', run: () => (zoomBy.current(0), true) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            setDraftRef.current(path, update.state.doc.toString());
          }),
        ],
      });
      states.current.set(path, next);
    }

    view.setState(next);
    activePath.current = path;
    // A stored document carries the theme it was built with, so the current
    // one is pushed in on every switch rather than only when it changes.
    view.dispatch({ effects: themeSlot.reconfigure(themeRef.current) });
    view.focus();

    const wanted = languageForFile(name);
    if (applied.current.get(path) !== wanted) {
      void loadLanguage(wanted).then((extension) => {
        // Only the path can say whether this grammar is still wanted. The
        // state it was requested for is long gone by now — the theme
        // reconfigure above already replaced it.
        if (activePath.current !== path) return;
        viewRef.current?.dispatch({
          effects: languageSlot.reconfigure(extension ?? []),
        });
        applied.current.set(path, wanted);
      });
    }

    // Attached separately and never awaited alongside the grammar. A host with
    // no server installed for this language is an ordinary state, so a failure
    // here is logged and the file stays perfectly editable without it.
    if (hostId && root && !lspAttached.current.has(path)) {
      lspAttached.current.add(path);
      void languageServerFor(hostId, root, wanted, path)
        .then((support) => {
          if (!support || activePath.current !== path) return;
          viewRef.current?.dispatch({ effects: lspSlot.reconfigure(support) });
        })
        .catch((e) => {
          lspAttached.current.delete(path);
          debugLog(`no language server for ${wanted}: ${e}`);
        });
    }
    // `draft` is deliberately absent: it is synced by the effect below, and
    // reacting to it here would rebuild the document on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, name, hostId, root]);

  // Content changed underneath the editor — a reload from the server, say.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !path || draft === null) return;
    const shown = view.state.doc.toString();
    if (shown === draft) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: draft },
    });
  }, [draft, path]);

  useEffect(() => {
    const open = new Set(buffers.map((b) => b.path));
    for (const key of [...states.current.keys()]) {
      if (open.has(key)) continue;
      states.current.delete(key);
      applied.current.delete(key);
      lspAttached.current.delete(key);
    }
  }, [buffers]);

  return <div ref={host} className="min-h-0 flex-1 overflow-hidden" />;
}

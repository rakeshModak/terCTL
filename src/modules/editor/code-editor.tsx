import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useResolvedMode } from '@/hooks/useResolvedMode';
import { languageForFile } from '@/lib/language';
import {
  applyMonacoTheme,
  editorFontFamily,
  monaco,
  TERCTL_MONACO_THEME,
} from '@/lib/monaco';
import { themeTokens } from '@/lib/theme';
import { FONT_SIZE_MAX, FONT_SIZE_MIN, settingsAtom } from '@/store/settings';
import {
  activeBufferAtom,
  buffersAtom,
  editorFontSize,
  editorZoomAtom,
  saveBufferAtom,
  setDraftAtom,
} from '@/store/editor';

const WHEEL_ZOOM_STEP = 40;

export default function CodeEditor() {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const models = useRef(new Map<string, monaco.editor.ITextModel>());
  const saveActive = useRef<() => void>(() => {});
  const zoomBy = useRef<(delta: number) => void>(() => {});

  const buffer = useAtomValue(activeBufferAtom);
  const buffers = useAtomValue(buffersAtom);
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

    const editor = monaco.editor.create(host.current, {
      theme: TERCTL_MONACO_THEME,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'line',
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      fontLigatures: true,
      tabSize: 2,
      trimAutoWhitespace: false,
      padding: { top: 10, bottom: 10 },
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
    });
    editorRef.current = editor;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      saveActive.current(),
    );
    for (const key of [monaco.KeyCode.Equal, monaco.KeyCode.NumpadAdd]) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | key, () => zoomBy.current(1));
    }
    for (const key of [monaco.KeyCode.Minus, monaco.KeyCode.NumpadSubtract]) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | key, () => zoomBy.current(-1));
    }
    for (const key of [monaco.KeyCode.Digit0, monaco.KeyCode.Numpad0]) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | key, () => zoomBy.current(0));
    }

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

    const opened = models.current;
    return () => {
      node.removeEventListener('wheel', onWheel);
      editor.dispose();
      opened.forEach((m) => m.dispose());
      opened.clear();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    applyMonacoTheme(themeTokens({ accent, theme, mode }), mode === 'dark');
  }, [accent, theme, mode]);

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontSize: effectiveSize,
      lineHeight: Math.round(effectiveSize * 1.55),
      fontFamily: editorFontFamily,
    });
  }, [effectiveSize]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (!path || name === null || draft === null) {
      editor.setModel(null);
      return;
    }

    let model = models.current.get(path);
    if (!model) {
      const created = monaco.editor.createModel(
        draft,
        languageForFile(name),
        monaco.Uri.parse(`terctl:${path}`),
      );
      created.setEOL(monaco.editor.EndOfLineSequence.LF);
      created.onDidChangeContent(() => setDraft(path, created.getValue()));
      models.current.set(path, created);
      model = created;
    }

    if (editor.getModel() !== model) editor.setModel(model);
    editor.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, setDraft]);

  useEffect(() => {
    if (!path || draft === null) return;
    const model = models.current.get(path);
    if (model && model.getValue() !== draft) model.setValue(draft);
  }, [draft, path]);

  useEffect(() => {
    const open = new Set(buffers.map((b) => b.path));
    for (const [key, model] of models.current) {
      if (open.has(key)) continue;
      model.dispose();
      models.current.delete(key);
    }
  }, [buffers]);

  return <div ref={host} className="min-h-0 flex-1" />;
}

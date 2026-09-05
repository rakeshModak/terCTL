import { useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  ChevronDown,
  FolderOpen,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Server,
  SquareTerminal,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import HostPickerDialog from '@/modules/transfer/host-picker-dialog';
import { useDragSize } from '@/hooks/useDragSize';
import { languageForFile } from '@/lib/language';
import { cn } from '@/lib/utils';
import { sftpService } from '@/services/sftp.service';
import { hostsAtom } from '@/store/app';
import { promptAtom } from '@/store/dialog';
import { FONT_SIZE_MAX, FONT_SIZE_MIN, settingsAtom } from '@/store/settings';
import {
  activeBufferAtom,
  editorFontSize,
  editorHostIdAtom,
  editorRootAtom,
  editorZoomAtom,
  isDirty,
  openWorkspaceAtom,
  reloadBufferAtom,
  saveBufferAtom,
} from '@/store/editor';
import CodeEditor from './code-editor';
import FileTree from './file-tree';
import LanguageServerButton from './language-server-button';
import TabBar from './tab-bar';
import TerminalPanel from './terminal-panel';

const DEFAULT_TERMINAL_HEIGHT = 240;
const MIN_TERMINAL_HEIGHT = 96;
const MIN_EDITOR_HEIGHT = 140;

const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 150;
const MIN_MAIN_WIDTH = 320;

const GRAB =
  "relative shrink-0 after:absolute after:bg-transparent after:transition-colors after:content-[''] hover:after:bg-primary";

export default function EditorView() {
  const hosts = useAtomValue(hostsAtom);
  const hostId = useAtomValue(editorHostIdAtom);
  const root = useAtomValue(editorRootAtom);
  const buffer = useAtomValue(activeBufferAtom);
  const { fontSize } = useAtomValue(settingsAtom);
  const zoom = useAtomValue(editorZoomAtom);
  const setZoom = useSetAtom(editorZoomAtom);
  const openWorkspace = useSetAtom(openWorkspaceAtom);
  const save = useSetAtom(saveBufferAtom);
  const reload = useSetAtom(reloadBufferAtom);
  const prompt = useSetAtom(promptAtom);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [showTerminal, setShowTerminal] = useState(true);
  const [termHeight, setTermHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const bodyRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);

  const host = hosts.find((h) => h.id === hostId);
  const path = buffer?.path ?? null;
  const shownSize = editorFontSize(fontSize, zoom);
  const language = buffer ? languageForFile(buffer.name) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && e.code === 'Backquote') {
        e.preventDefault();
        setShowTerminal((v) => !v);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (path) void save(path);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [path, save]);

  const startTerminalResize = useDragSize({
    axis: 'y',
    size: termHeight,
    onResize: setTermHeight,
    min: MIN_TERMINAL_HEIGHT,
    max: () => (bodyRef.current?.clientHeight ?? 0) - MIN_EDITOR_HEIGHT,
    reverse: true,
  });

  const startSidebarResize = useDragSize({
    axis: 'x',
    size: sidebarWidth,
    onResize: setSidebarWidth,
    min: MIN_SIDEBAR_WIDTH,
    max: () => (splitRef.current?.clientWidth ?? 0) - MIN_MAIN_WIDTH,
  });

  const bumpZoom = (delta: number) =>
    setZoom(
      Math.min(
        FONT_SIZE_MAX - fontSize,
        Math.max(FONT_SIZE_MIN - fontSize, zoom + delta),
      ),
    );

  const chooseHost = async (id: string) => {
    try {
      openWorkspace(id, await sftpService.home(id));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const changeFolder = async () => {
    if (!hostId) return;
    const next = await prompt({
      title: 'Open folder',
      initialValue: root ?? '/',
      placeholder: '/var/www',
      confirmLabel: 'Open',
    });
    if (!next) return;
    try {
      await sftpService.list(hostId, next);
      openWorkspace(hostId, next);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const dirty = buffer ? isDirty(buffer) : false;

  return (
    <div className="bg-background flex min-w-0 flex-1 flex-col">
      <div className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <Server />
          {host ? host.label : 'Choose server'}
        </Button>

        {hostId && (
          <Button variant="ghost" size="sm" onClick={() => void changeFolder()}>
            <FolderOpen />
            Open folder
          </Button>
        )}

        <span className="flex-1" />

        {buffer && language && (
          <>
            <span className="text-muted-foreground font-mono text-[11px]">
              {language} · {buffer.eol.toUpperCase()}
            </span>

            <div className="border-border flex items-center rounded-md border">
              <Button
                variant="ghost"
                size="icon-xs"
                title="Zoom out"
                disabled={shownSize <= FONT_SIZE_MIN}
                onClick={() => bumpZoom(-1)}
              >
                <Minus />
              </Button>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setZoom(0)}
                      className="text-muted-foreground hover:text-foreground w-7 font-mono text-[11px] tabular-nums outline-none"
                    />
                  }
                >
                  {shownSize}
                </TooltipTrigger>
                <TooltipContent>
                  Editor text size — Ctrl + scroll, or Ctrl 0 to reset
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon-xs"
                title="Zoom in"
                disabled={shownSize >= FONT_SIZE_MAX}
                onClick={() => bumpZoom(1)}
              >
                <Plus />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              title="Reload from the server"
              disabled={buffer.saving}
              onClick={() => void reload(buffer.path)}
            >
              <RotateCcw />
            </Button>
            <Button
              variant={dirty ? 'default' : 'ghost'}
              size="sm"
              disabled={!dirty || buffer.saving}
              onClick={() => void save(buffer.path)}
            >
              <Save />
              {buffer.saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        )}

        {hostId && (
          <LanguageServerButton
            key={hostId}
            hostId={hostId}
            hostLabel={host?.label ?? 'the server'}
            language={language}
          />
        )}

        {hostId && (
          <Button
            variant="ghost"
            size="icon-sm"
            title={`${showTerminal ? 'Hide' : 'Show'} terminal — Ctrl \``}
            onClick={() => setShowTerminal((v) => !v)}
            className={cn(showTerminal && 'text-primary')}
          >
            <SquareTerminal />
          </Button>
        )}
      </div>

      <div ref={splitRef} className="flex min-h-0 flex-1">
        <aside
          className="border-border flex shrink-0 flex-col border-r"
          style={{ width: sidebarWidth }}
        >
          <FileTree key={`${hostId ?? ''}:${root ?? ''}`} />
        </aside>
        <div
          onPointerDown={startSidebarResize}
          title="Drag to resize"
          className={cn(
            GRAB,
            '-ml-1 w-2 cursor-col-resize after:top-0 after:bottom-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2',
          )}
        />

        <div ref={bodyRef} className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <TabBar />
            {buffer ? (
              <CodeEditor />
            ) : (
              <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center px-6 text-center text-xs">
                {hostId
                  ? 'Pick a file from the tree to start editing.'
                  : 'Choose a server to browse and edit its files over SFTP.'}
              </div>
            )}
          </div>

          {hostId && (
            <div
              className="border-border shrink-0 flex-col border-t"
              style={{
                height: termHeight,
                display: showTerminal ? 'flex' : 'none',
              }}
            >
              <div
                onPointerDown={startTerminalResize}
                title="Drag to resize"
                className={cn(
                  GRAB,
                  '-mt-1 h-2 cursor-row-resize after:top-1/2 after:right-0 after:left-0 after:h-0.5 after:-translate-y-1/2',
                )}
              />
              <div className="text-muted-foreground flex h-7 shrink-0 items-center gap-1.5 px-3 font-mono text-[11px]">
                <SquareTerminal className="size-3" />
                <span>Terminal</span>
                <span className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Hide terminal — Ctrl `"
                  onClick={() => setShowTerminal(false)}
                >
                  <ChevronDown />
                </Button>
              </div>
              <div className="relative min-h-0 flex-1">
                <TerminalPanel key={hostId} hostId={hostId} />
              </div>
            </div>
          )}
        </div>
      </div>

      <HostPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        hosts={hosts}
        value={hostId ?? ''}
        onSelect={(id) => void chooseHost(id)}
      />
    </div>
  );
}

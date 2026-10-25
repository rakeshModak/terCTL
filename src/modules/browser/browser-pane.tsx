import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { openUrl } from '@tauri-apps/plugin-opener';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  ExternalLink,
  House,
  RotateCw,
  Unplug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { debugLog } from '@/lib/debugLog';
import { browserService } from '@/services/browser.service';
import { reconnectAtom, repointBrowserPaneAtom } from '@/store/app';
import { browserViewsSuppressedAtom } from '@/store/browser';
import type { SessionType } from '@/types/session';
import type { PaneRectType, ProbeResultType } from '@/types/browser';
import { formatAddress, parseAddress, type Address } from './address';
import { usePaneRect } from './use-pane-rect';

interface BrowserPaneProps {
  session: SessionType;
}

/** The answer to the last probe, tagged with the request it answers. */
interface ProbeState {
  /** Replies tagged with anything else are stale and ignored. */
  request: string;
  result: ProbeResultType | null;
  error: string | null;
}

const NOT_PROBED: ProbeState = { request: '', result: null, error: null };

const rectKey = (rect: PaneRectType) =>
  `${rect.x},${rect.y},${rect.width},${rect.height}`;

/**
 * A page served from a remote port, rendered next to the shell serving it.
 *
 * The page is a real child webview, not a frame. That is what makes logging in
 * work: a framed page is cross-site to the app's own document, so its session
 * cookie is never sent back and every authenticated service bounces straight
 * to its login screen. As a top-level document it is first-party to itself,
 * and behaves exactly as it would in a browser tab.
 *
 * The cost is that the webview is a native surface — it sits above the React
 * layer rather than inside it — so this component spends most of its length
 * telling it where to be and when to get out of the way.
 */
export default function BrowserPane({ session }: BrowserPaneProps) {
  const tunnel = session.tunnel;
  const repoint = useSetAtom(repointBrowserPaneAtom);
  const reconnect = useSetAtom(reconnectAtom);
  const suppressed = useAtomValue(browserViewsSuppressedAtom);

  const [path, setPath] = useState(session.initialPath ?? '/');
  /** Non-null only while the address bar is being edited. */
  const [draft, setDraft] = useState<string | null>(null);
  const [probe, setProbe] = useState<ProbeState>(NOT_PROBED);
  const [reloadNonce, setReloadNonce] = useState(0);

  const hostRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const address: Address = {
    host: tunnel?.remoteHost ?? '127.0.0.1',
    port: tunnel?.remotePort ?? 0,
    path,
  };
  const shown = formatAddress(address);
  const localUrl = tunnel ? `http://127.0.0.1:${tunnel.localPort}${path}` : '';
  const live = session.status === 'connected' && !!tunnel;

  const requestId = `${tunnel?.id ?? ''}|${path}|${reloadNonce}`;
  const probing = live && probe.request !== requestId;
  const failed = !!probe.error;

  // ---- keeping the webview where the pane is ----

  const rect = useRef<PaneRectType | null>(null);
  const wanted = useRef(false);
  /** What the webview was last told, so nothing is sent twice. */
  const settled = useRef({ shown: false, rect: '' });

  const sync = useCallback(() => {
    const label = session.id;
    const box = rect.current;

    if (!wanted.current || !box) {
      if (settled.current.shown) {
        settled.current = { shown: false, rect: '' };
        void browserService.view.hide(label);
      }
      return;
    }
    const key = rectKey(box);
    if (!settled.current.shown) {
      settled.current = { shown: true, rect: key };
      void browserService.view.show(label, box);
    } else if (settled.current.rect !== key) {
      settled.current.rect = key;
      void browserService.view.setRect(label, box);
    }
  }, [session.id]);

  usePaneRect(
    hostRef,
    useCallback(
      (next: PaneRectType | null) => {
        rect.current = next;
        sync();
      },
      [sync],
    ),
  );

  // The webview must also stand down for anything drawn over it, and while the
  // pane is showing a notice instead of a page.
  const visible = live && !failed && !suppressed;
  useEffect(() => {
    wanted.current = visible;
    sync();
  }, [visible, sync]);

  // ---- loading pages ----

  // A page the webview reached by itself must never be handed back to it: that
  // would reload it under the user on every in-page navigation.
  const selfNavigated = useRef(false);

  useEffect(() => {
    if (!localUrl) return;
    if (selfNavigated.current) {
      selfNavigated.current = false;
      return;
    }
    // Measured here rather than waited for: the placeholder is in the DOM by
    // now, and the frame loop corrects the box a moment later either way.
    const box = hostRef.current?.getBoundingClientRect();
    const at: PaneRectType = box
      ? {
          x: Math.round(box.left),
          y: Math.round(box.top),
          width: Math.round(box.width),
          height: Math.round(box.height),
        }
      : { x: 0, y: 0, width: 1, height: 1 };
    rect.current = at;
    settled.current = { shown: true, rect: rectKey(at) };
    void browserService.view
      .open(session.id, localUrl, at)
      .catch((e) => debugLog(`could not open the browser view: ${e}`));
  }, [localUrl, session.id]);

  // The webview outlives every re-render but not the pane.
  useEffect(() => {
    const label = session.id;
    return () => {
      void browserService.view.close(label);
    };
  }, [session.id]);

  useEffect(() => {
    const unlisten = browserService.view.onNavigated(({ label, url }) => {
      if (label !== session.id) return;
      try {
        const next = new URL(url);
        selfNavigated.current = true;
        setPath(`${next.pathname}${next.search}`);
      } catch {
        // A page can navigate somewhere unparseable; the bar just keeps up.
      }
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [session.id]);

  useEffect(() => {
    const unlisten = browserService.view.onExternal(({ label, url }) => {
      if (label !== session.id) return;
      toast.info('Opened in your browser', {
        description: `${url} is outside this forward.`,
      });
      void openUrl(url).catch((e) => debugLog(`could not open ${url}: ${e}`));
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [session.id]);

  // ---- probing ----

  useEffect(() => {
    if (!tunnel) return;
    // Only the reply writes state, so a superseded probe cannot clobber a
    // newer one — and nothing is set synchronously during the effect.
    let current = true;
    void browserService
      .probe(tunnel.id, path)
      .then((result) => {
        if (current) setProbe({ request: requestId, result, error: null });
      })
      .catch((e: unknown) => {
        if (current)
          setProbe({ request: requestId, result: null, error: String(e) });
      });
    return () => {
      current = false;
    };
  }, [tunnel, path, requestId]);

  // ---- toolbar ----

  const reload = () => {
    setReloadNonce((n) => n + 1);
    void browserService.view.reload(session.id);
  };

  const openExternally = () => {
    void openUrl(localUrl).catch((e) =>
      debugLog(`could not open ${localUrl}: ${e}`),
    );
  };

  const submit = () => {
    const next = parseAddress(draft ?? shown, address);
    setDraft(null);
    inputRef.current?.blur();
    if (!next) return;

    setPath(next.path);
    if (next.port !== address.port || next.host !== address.host) {
      void repoint(session.id, next.port, next.host).catch((e) =>
        debugLog(`could not re-point the browser pane: ${e}`),
      );
    } else if (next.path === path) {
      // Same address — Enter means "fetch it again".
      reload();
    }
  };

  const firstLook = probing && !probe.result && !probe.error;

  return (
    <div className="bg-background absolute inset-0 flex flex-col">
      <div className="border-border flex shrink-0 items-center gap-1 border-b px-1.5 py-1.5">
        {/* The webview owns its history and does not report how deep it is, so
            these stay enabled; a press with nowhere to go is a no-op, which
            beats a button that is wrongly greyed out. */}
        <Button
          variant="ghost"
          size="icon-xs"
          title="Back"
          onClick={() => void browserService.view.back(session.id)}
          disabled={!live}
        >
          <ArrowLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          title="Forward"
          onClick={() => void browserService.view.forward(session.id)}
          disabled={!live}
        >
          <ArrowRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          title="Reload"
          onClick={reload}
          disabled={!live}
        >
          <RotateCw className={cn(probing && 'animate-spin')} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          title="Back to /"
          onClick={() => setPath('/')}
          disabled={!live || path === '/'}
        >
          <House />
        </Button>

        <input
          ref={inputRef}
          value={draft ?? shown}
          spellCheck={false}
          aria-label="Address on the server"
          placeholder="127.0.0.1:3000/"
          className={cn(
            'border-border bg-card text-foreground min-w-0 flex-1 rounded-md border px-2 py-1 font-mono text-xs',
            'focus-visible:ring-ring outline-none focus-visible:ring-2',
          )}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => {
            setDraft(shown);
            e.currentTarget.select();
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
              setDraft(null);
              inputRef.current?.blur();
            }
          }}
        />

        <Button
          variant="ghost"
          size="icon-xs"
          title="Open in your system browser"
          onClick={openExternally}
          disabled={!live}
        >
          <ExternalLink />
        </Button>
      </div>

      <StatusStrip probe={probe} probing={probing} tunnel={tunnel} />

      <div className="relative min-h-0 flex-1">
        {!live ? (
          <Notice
            icon={<Unplug className="size-5" />}
            title="This forward is closed"
            detail="The SSH connection carrying it dropped."
            action={
              <Button size="sm" onClick={() => void reconnect(session.id)}>
                Reopen the forward
              </Button>
            }
          />
        ) : failed ? (
          <Notice
            tone="destructive"
            icon={<CircleAlert className="size-5" />}
            title={`Nothing is answering on ${address.host}:${address.port}`}
            detail={probe.error ?? ''}
            action={
              <Button size="sm" onClick={reload}>
                Check again
              </Button>
            }
          />
        ) : (
          // The webview is painted over this box, never inside it. What shows
          // through is the moment before the first paint, and any time the
          // view has stood down for a dialog.
          <div ref={hostRef} className="absolute inset-0 bg-white">
            {firstLook && (
              <div className="absolute inset-0 flex items-center justify-center bg-(--bg) font-mono text-xs text-(--text-dim)">
                Reaching {shown}…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The one-line answer to "is this port actually serving anything?". */
function StatusStrip({
  probe,
  probing,
  tunnel,
}: {
  probe: ProbeState;
  probing: boolean;
  tunnel: SessionType['tunnel'];
}) {
  const { result, error } = probe;
  const ok = result?.status != null && result.status < 400;

  return (
    <div className="border-border text-2xs flex shrink-0 items-center gap-2 border-b px-2.5 py-1 font-mono">
      {probing ? (
        <span className="text-(--text-dim)">checking…</span>
      ) : error ? (
        <span className="text-destructive">no response</span>
      ) : result ? (
        <>
          <span className={ok ? 'text-chart-4' : 'text-destructive'}>
            {result.status} {result.statusText}
          </span>
          {result.contentType && (
            <span className="truncate text-(--text-dim)">
              {result.contentType.split(';')[0]}
            </span>
          )}
          {result.server && (
            <span className="truncate text-(--text-faint)">
              {result.server}
            </span>
          )}
          <span className="text-(--text-faint)">{result.elapsedMs} ms</span>
        </>
      ) : null}

      <span className="flex-1" />
      {tunnel && (
        <span
          className="shrink-0 text-(--text-faintest)"
          title={`Forwarded over SSH from this machine's 127.0.0.1:${tunnel.localPort}`}
        >
          via :{tunnel.localPort}
        </span>
      )}
    </div>
  );
}

function Notice({
  icon,
  title,
  detail,
  action,
  tone,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  action: ReactNode;
  tone?: 'destructive';
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-full',
          tone === 'destructive'
            ? 'bg-destructive/12 text-destructive'
            : 'bg-primary/12 text-primary',
        )}
      >
        {icon}
      </span>
      <div className="text-sm font-semibold">{title}</div>
      <div className="max-w-sm font-mono text-xs leading-relaxed wrap-break-word text-(--text-dim)">
        {detail}
      </div>
      {action}
    </div>
  );
}

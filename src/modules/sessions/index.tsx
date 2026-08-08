import { useNavigate } from '@tanstack/react-router';
import { useAtomValue, useSetAtom } from 'jotai';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TerctlLoader } from '../../components/chrome/TerctlLogo';
import {
  activeSessionIdAtom,
  activeTabIdAtom,
  closeSessionAtom,
  connectAtom,
  connectErrorAtom,
  connectingAtom,
  dismissConnectErrorAtom,
  draggingPaneSessionIdAtom,
  draggingTabIdAtom,
  hostsAtom,
  markDisconnectedAtom,
  openLocalTerminalAtom,
  newTabPickerAtom,
  reconnectAtom,
  repositionPaneAtom,
  sessionsAtom,
  setActiveSessionAtom,
  setDraggingPaneAtom,
  showInspectorAtom,
  splitWithAtom,
  tabsAtom,
  toggleInspectorAtom,
} from '../../store/app';
import DisconnectedBar from './disconnected-bar';
import EmptyWorkspace from './empty-workspace';
import Inspector from './inspector';
import PaneDividers from './pane-dividers';
import SessionPane from './session-pane';
import StatusOverlay from './status-overlay';
import { useSessionLayout } from '@/hooks/useSessionLayout';

export default function SessionsView() {
  const hosts = useAtomValue(hostsAtom);
  const sessions = useAtomValue(sessionsAtom);
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const activeSessionId = useAtomValue(activeSessionIdAtom);
  const draggingTabId = useAtomValue(draggingTabIdAtom);
  const draggingPaneSessionId = useAtomValue(draggingPaneSessionIdAtom);
  const connecting = useAtomValue(connectingAtom);
  const connectError = useAtomValue(connectErrorAtom);
  const showInspector = useAtomValue(showInspectorAtom);
  const newTabPicker = useAtomValue(newTabPickerAtom);

  const setDraggingPane = useSetAtom(setDraggingPaneAtom);
  const repositionPane = useSetAtom(repositionPaneAtom);
  const splitWith = useSetAtom(splitWithAtom);
  const setActiveSession = useSetAtom(setActiveSessionAtom);
  const closeSession = useSetAtom(closeSessionAtom);
  const markDisconnected = useSetAtom(markDisconnectedAtom);
  const reconnect = useSetAtom(reconnectAtom);
  const connect = useSetAtom(connectAtom);
  const openLocalTerminal = useSetAtom(openLocalTerminalAtom);
  const dismissConnectError = useSetAtom(dismissConnectErrorAtom);
  const toggleInspector = useSetAtom(toggleInspectorAtom);
  const navigate = useNavigate();

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const layout = activeTab?.layout ?? null;
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const activeHost = activeSession
    ? (hosts.find((h) => h.id === activeSession.hostId) ?? null)
    : null;

  const { areaRef, resizing, rectBySession, startDivider } =
    useSessionLayout(layout);

  const idle = !connecting && !connectError;
  const showEmpty = (tabs.length === 0 || newTabPicker) && idle;

  return (
    <div className="flex min-w-0 flex-1">
      <div className="bg-background flex min-w-0 flex-1 flex-col">
        <div
          ref={areaRef}
          className={`relative min-h-0 flex-1 ${resizing ? 'select-none' : ''}`}
        >
          {showEmpty && <EmptyWorkspace />}

          {connecting && (
            <StatusOverlay>
              <TerctlLoader size={54} glow={false} />
              <div className="text-sm font-semibold">
                Connecting to {connecting.label}
              </div>
              <div className="text-muted-foreground font-mono text-xs">
                Opening TCP channel · authenticating · requesting shell…
              </div>
            </StatusOverlay>
          )}

          {connectError && (
            <StatusOverlay variant="destructive">
              <span className="bg-destructive/12 text-destructive flex size-9 items-center justify-center rounded-full">
                <CircleAlert className="size-5" />
              </span>
              <div className="text-sm font-semibold">
                Couldn’t connect to {connectError.label}
              </div>
              <div className="text-destructive font-mono text-xs leading-relaxed wrap-break-word">
                {connectError.message}
              </div>
              <Button onClick={() => dismissConnectError()}>Dismiss</Button>
            </StatusOverlay>
          )}

          {sessions.map((session) => (
            <SessionPane
              key={session.id}
              session={session}
              rect={rectBySession.get(session.id)}
              active={session.id === activeSessionId}
              isSplit={rectBySession.size >= 2}
              resizing={resizing}
              dragging={draggingPaneSessionId === session.id}
              showZones={
                rectBySession.has(session.id) &&
                ((!!draggingTabId && draggingTabId !== activeTabId) ||
                  (!!draggingPaneSessionId &&
                    draggingPaneSessionId !== session.id))
              }
              termScheme={
                hosts.find((h) => h.id === session.hostId)?.termScheme ??
                undefined
              }
              onActivate={() => setActiveSession(session.id)}
              onClose={() => closeSession(session.id)}
              onClosed={() => markDisconnected(session.id)}
              onDragStart={() => setDraggingPane(session.id)}
              onDragEnd={() => setDraggingPane(null)}
              onSplit={(edge) =>
                draggingPaneSessionId
                  ? repositionPane(draggingPaneSessionId, session.id, edge)
                  : splitWith(session.id, edge)
              }
            />
          ))}

          <PaneDividers layout={layout} onDragStart={startDivider} />

          {activeSession?.status === 'disconnected' && (
            <DisconnectedBar
              onReconnect={() => reconnect(activeSession.id)}
              onClose={() => closeSession(activeSession.id)}
            />
          )}

          {activeSession?.status === 'reconnecting' && (
            <StatusOverlay>
              <TerctlLoader size={54} glow={false} />
              <div className="text-sm font-semibold">
                Reconnecting to {activeSession.label}…
              </div>
            </StatusOverlay>
          )}
        </div>
      </div>

      {activeSession && showInspector && (
        <Inspector
          session={activeSession}
          host={activeHost}
          onClose={() => toggleInspector()}
          onDisconnect={() => closeSession(activeSession.id)}
          onDuplicate={() =>
            void (activeHost ? connect(activeHost) : openLocalTerminal())
          }
          onOpenSftp={() => navigate({ to: '/transfer' })}
        />
      )}
    </div>
  );
}

import { atom } from 'jotai';
import { browserService } from '../services/browser.service';
import type { ListeningPortType } from '@/types/browser';
import {
  connectErrorAtom,
  connectingAtom,
  contextMenuOpenAtom,
  draggingPaneSessionIdAtom,
  draggingTabIdAtom,
  newTabPickerAtom,
} from './app';
import { confirmReqAtom, promptReqAtom } from './dialog';

// State for choosing *which* remote port to browse. The panes themselves are
// sessions, so their lifecycle lives with the rest in ./app.

/** One host's scan of remote listening ports. */
export interface PortScan {
  ports: ListeningPortType[];
  loading: boolean;
  error: string | null;
}

const EMPTY_SCAN: PortScan = { ports: [], loading: false, error: null };

/** Which host the port picker is open for; null when it is closed. */
export const portPickerHostIdAtom = atom<string | null>(null);

/**
 * Last scan per host. Cached so re-opening the picker shows the previous list
 * immediately and refreshes underneath it, rather than flashing empty — a
 * scan costs an SSH round trip.
 */
export const portScansAtom = atom<Record<string, PortScan>>({});

export const portScanAtom = atom(
  (get) => (hostId: string | null) =>
    hostId ? (get(portScansAtom)[hostId] ?? EMPTY_SCAN) : EMPTY_SCAN,
);

export const scanPortsAtom = atom(null, async (get, set, hostId: string) => {
  const previous = get(portScansAtom)[hostId] ?? EMPTY_SCAN;
  const patch = (scan: PortScan) =>
    set(portScansAtom, { ...get(portScansAtom), [hostId]: scan });

  patch({ ...previous, loading: true, error: null });
  try {
    const ports = await browserService.listeningPorts(hostId);
    patch({ ports, loading: false, error: null });
  } catch (e) {
    // Keep whatever was listed before: a failed refresh should not wipe a
    // list the user is mid-way through reading.
    patch({ ...previous, loading: false, error: String(e) });
  }
});

export const openPortPickerAtom = atom(null, (_get, set, hostId: string) => {
  set(portPickerHostIdAtom, hostId);
  // Re-scan on every open: ports come and go exactly as fast as the dev server
  // the user is restarting.
  void set(scanPortsAtom, hostId);
});

export const closePortPickerAtom = atom(null, (_get, set) => {
  set(portPickerHostIdAtom, null);
});

/**
 * Whether the browser panes must stand down.
 *
 * Their webviews are native surfaces painted over the React layer, not
 * elements within it, so anything the app means to draw on top — a dialog, an
 * overlay, the drop zones during a drag — would end up behind them. There is
 * no z-index that reaches across that boundary; the only answer is to hide the
 * webview while such a thing is up.
 *
 * A pane that is simply off-screen (wrong tab, another route) needs no entry
 * here: it measures as an empty box, and the pane hides itself on that.
 */
export const browserViewsSuppressedAtom = atom(
  (get) =>
    get(portPickerHostIdAtom) !== null ||
    get(promptReqAtom) !== null ||
    get(confirmReqAtom) !== null ||
    get(connectingAtom) !== null ||
    get(connectErrorAtom) !== null ||
    get(newTabPickerAtom) ||
    get(contextMenuOpenAtom) ||
    get(draggingTabIdAtom) !== null ||
    get(draggingPaneSessionIdAtom) !== null,
);

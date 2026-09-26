import type { Pane } from '@/lib/layout';
import type { TunnelType } from '@/types/browser';

/** What a pane holds: a PTY stream, or a forwarded port rendered as a page. */
export type SessionKind = 'terminal' | 'browser';

export interface SessionType {
  id: string;
  hostId: string;
  label: string;
  kind: SessionKind;
  status: 'connected' | 'disconnected' | 'reconnecting' | 'connecting';
  tunnel?: TunnelType;
  initialPath?: string;
}

export interface TabType {
  id: string;
  label: string;
  layout: Pane;
}

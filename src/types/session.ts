import type { Pane } from '@/lib/layout';

export interface SessionType {
  id: string;
  hostId: string;
  label: string;
  /** 'connecting' is a placeholder pane: no backend session exists for `id` yet. */
  status: 'connected' | 'disconnected' | 'reconnecting' | 'connecting';
}

export interface TabType {
  id: string;
  label: string;
  layout: Pane;
}

import type { Pane } from '@/lib/layout';

export interface SessionType {
  id: string;
  hostId: string;
  label: string;
  status: 'connected' | 'disconnected' | 'reconnecting';
}

export interface TabType {
  id: string;
  label: string;
  layout: Pane;
}

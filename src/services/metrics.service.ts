import { call } from './config/tauri-api';
import type { MetricsType } from '@/types/metrics';

export const metricsService = {
  get: (hostId: string) => call<MetricsType>('ssh_metrics', { hostId }),
  disconnect: (hostId: string) => call<void>('metrics_disconnect', { hostId }),
};

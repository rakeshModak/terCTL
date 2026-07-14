import { call } from './config/tauri-api'
import type { Metrics } from '../models'

export const metricsService = {
  get: (hostId: string) => call<Metrics>('ssh_metrics', { hostId }),
  disconnect: (hostId: string) => call<void>('metrics_disconnect', { hostId }),
}

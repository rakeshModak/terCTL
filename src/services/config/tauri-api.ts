import { invoke } from '@tauri-apps/api/core'

// Centralized Tauri IPC client — the desktop analogue of CalmUI's fetch-api.
// Every service goes through `call()` so command invocation (and any future
// logging / error handling) lives in one place.
export function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args)
}

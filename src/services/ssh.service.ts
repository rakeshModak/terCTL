import { call } from './config/tauri-api'

// Terminal session lifecycle + I/O (SSH and local PTY share this plumbing).
export const sshService = {
  connect: (hostId: string) => call<string>('ssh_connect', { hostId }),
  localConnect: () => call<string>('local_connect'),
  disconnect: (sessionId: string) => call<void>('term_disconnect', { sessionId }),
  sendInput: (sessionId: string, data: number[]) =>
    call<void>('term_send_input', { sessionId, data }),
  resize: (sessionId: string, cols: number, rows: number) =>
    call<void>('term_resize', { sessionId, cols, rows }),
}

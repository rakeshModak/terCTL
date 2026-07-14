import { call } from './config/tauri-api'

export const credentialsService = {
  save: (hostId: string, kind: 'password' | 'passphrase', value: string) =>
    call<void>('save_credential', { hostId, kind, value }),
}

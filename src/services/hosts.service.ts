import { call } from './config/tauri-api'
import type { Group, Host, NewHost } from '../models'

export const hostsService = {
  list: () => call<Host[]>('list_hosts'),
  add: (newHost: NewHost) => call<Host>('add_host', { newHost }),
  update: (host: Host) => call<void>('update_host', { host }),
  remove: (id: string) => call<void>('delete_host', { id }),

  listGroups: () => call<Group[]>('list_groups'),
  addGroup: (name: string, parentId: string | null = null) =>
    call<Group>('add_group', { name, parentId }),
  renameGroup: (id: string, name: string) => call<void>('rename_group', { id, name }),
  deleteGroup: (id: string) => call<void>('delete_group', { id }),

  listTags: () => call<string[]>('list_tags'),
}

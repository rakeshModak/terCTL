import { call } from './config/tauri-api'
import type { GroupType, HostType, NewHostType } from '@/types/host'

export const hostsService = {
  list: () => call<HostType[]>('list_hosts'),
  add: (newHost: NewHostType) => call<HostType>('add_host', { newHost }),
  update: (host: HostType) => call<void>('update_host', { host }),
  remove: (id: string) => call<void>('delete_host', { id }),

  listGroups: () => call<GroupType[]>('list_groups'),
  addGroup: (name: string, parentId: string | null = null) =>
    call<GroupType>('add_group', { name, parentId }),
  renameGroup: (id: string, name: string) => call<void>('rename_group', { id, name }),
  deleteGroup: (id: string) => call<void>('delete_group', { id }),

  listTags: () => call<string[]>('list_tags'),
}

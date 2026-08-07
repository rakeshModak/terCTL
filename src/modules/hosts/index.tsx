import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  allTagsAtom,
  connectAtom,
  groupsAtom,
  hostsAtom,
  refreshAllAtom,
  setTagFilterAtom,
  tagFilterAtom,
} from '../../store/app'
import { hostsService } from '../../services/hosts.service'
import type { Group, Host } from '../../models'
import { DeleteAlert } from './DeleteAlert'
import { GroupBreadcrumb } from './GroupBreadcrumb'
import { GroupCard } from './GroupCard'
import { GroupFormDialog } from './GroupFormDialog'
import { HostCard } from './HostCard'
import { HostFormSheet } from './HostFormSheet'
import { HostsEmptyState } from './HostsEmptyState'
import { HostsHeader } from './HostsHeader'
import { SectionHeading } from './SectionHeading'
import { TagFilterBar } from './TagFilterBar'
import { useHostsBrowser } from './useHostsBrowser'

type HostSheetArgs = { host?: Host; groupId: string | null }
type GroupDialogArgs =
  { mode: 'create'; parentId: string | null } | { mode: 'rename'; group: Group }
type DeleteTarget = { kind: 'group'; group: Group } | { kind: 'host'; host: Host }

const GRID = 'grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(228px,1fr))]'

export function HostsPage() {
  const hosts = useAtomValue(hostsAtom)
  const groups = useAtomValue(groupsAtom)
  const allTags = useAtomValue(allTagsAtom)
  const tagFilter = useAtomValue(tagFilterAtom)
  const connect = useSetAtom(connectAtom)
  const refreshAll = useSetAtom(refreshAllAtom)
  const setTagFilter = useSetAtom(setTagFilterAtom)
  const navigate = useNavigate()

  const [path, setPath] = useState<string[]>([])
  const [query, setQuery] = useState('')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetArgs, setSheetArgs] = useState<HostSheetArgs>({ groupId: null })

  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupDialogArgs, setGroupDialogArgs] = useState<GroupDialogArgs>({
    mode: 'create',
    parentId: null,
  })

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const view = useHostsBrowser({ hosts, groups, path, query, tagFilter })

  const openCreateHost = (groupId: string | null) => {
    setSheetArgs({ host: undefined, groupId })
    setSheetOpen(true)
  }

  const openEditHost = (host: Host) => {
    setSheetArgs({ host, groupId: null })
    setSheetOpen(true)
  }

  const openCreateGroup = () => {
    setGroupDialogArgs({ mode: 'create', parentId: view.currentGroupId })
    setGroupDialogOpen(true)
  }

  const openRenameGroup = (group: Group) => {
    setGroupDialogArgs({ mode: 'rename', group })
    setGroupDialogOpen(true)
  }

  const askDelete = (target: DeleteTarget) => {
    setDeleteTarget(target)
    setDeleteOpen(true)
  }

  const submitGroupDialog = async (name: string) => {
    if (groupDialogArgs.mode === 'create') {
      await hostsService.addGroup(name, groupDialogArgs.parentId)
    } else if (name !== groupDialogArgs.group.name) {
      await hostsService.renameGroup(groupDialogArgs.group.id, name)
    }
    await refreshAll()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'group') {
      await hostsService.deleteGroup(deleteTarget.group.id)
    } else {
      await hostsService.remove(deleteTarget.host.id)
    }
    await refreshAll()
  }

  const openHost = (host: Host) => {
    void connect(host)
    navigate({ to: '/sessions' })
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="px-8 pt-5 pb-8">
        <HostsHeader
          hostCount={hosts.length}
          groupCount={view.rootGroupCount}
          query={query}
          onQueryChange={setQuery}
          onNewGroup={openCreateGroup}
          onNewHost={() => openCreateHost(view.currentGroupId)}
          showActions={!view.isEmpty}
        />

        <TagFilterBar tags={allTags} value={tagFilter} onChange={setTagFilter} />

        {view.insideGroup && (
          <GroupBreadcrumb
            trail={view.breadcrumb}
            onNavigate={(depth) => setPath(path.slice(0, depth))}
          />
        )}

        {view.subgroups.length > 0 && (
          <section className="mb-7">
            <SectionHeading>{view.insideGroup ? 'Subgroups' : 'Groups'}</SectionHeading>
            <div className={GRID}>
              {view.subgroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  hostCount={view.countDescendants(group.id)}
                  onOpen={() => setPath([...path, group.id])}
                  onRename={() => openRenameGroup(group)}
                  onDelete={() => askDelete({ kind: 'group', group })}
                />
              ))}
            </div>
          </section>
        )}

        {view.isEmpty ? (
          <HostsEmptyState onNewHost={() => openCreateHost(null)} onNewGroup={openCreateGroup} />
        ) : (
          <section>
            <SectionHeading detail={view.currentGroup?.name} count={view.visibleHosts.length}>
              Hosts
            </SectionHeading>
            <div className={GRID}>
              {view.visibleHosts.map((host) => (
                <HostCard
                  key={host.id}
                  host={host}
                  onConnect={() => openHost(host)}
                  onEdit={() => openEditHost(host)}
                  onDelete={() => askDelete({ kind: 'host', host })}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <HostFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        host={sheetArgs.host}
        defaultGroupId={sheetArgs.groupId}
      />

      <GroupFormDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        title={groupDialogArgs.mode === 'create' ? 'New group' : 'Rename group'}
        description={
          groupDialogArgs.mode === 'create'
            ? 'Groups keep related servers together.'
            : 'Give this group a new name.'
        }
        confirmLabel={groupDialogArgs.mode === 'create' ? 'Create' : 'Rename'}
        placeholder="e.g. Production"
        initialValue={groupDialogArgs.mode === 'rename' ? groupDialogArgs.group.name : ''}
        onSubmit={(name) => void submitGroupDialog(name)}
      />

      {deleteTarget && (
        <DeleteAlert
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={
            deleteTarget.kind === 'group'
              ? `Delete "${deleteTarget.group.name}"?`
              : `Delete "${deleteTarget.host.label}"?`
          }
          description={
            deleteTarget.kind === 'group'
              ? 'Its hosts move to Ungrouped and its subgroups move up a level — nothing is deleted except the group.'
              : 'This also removes its saved credentials from the keychain.'
          }
          confirmLabel={deleteTarget.kind === 'group' ? 'Delete group' : 'Delete server'}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  )
}

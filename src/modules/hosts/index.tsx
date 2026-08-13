import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  allTagsAtom,
  connectAtom,
  groupsAtom,
  hostsAtom,
  refreshAllAtom,
  sessionsAtom,
  setActiveSessionAtom,
  setTagFilterAtom,
  tagFilterAtom,
} from '../../store/app';
import { hostsService } from '../../services/hosts.service';
import type { GroupType, HostType } from '@/types/host';
import ActiveSessions from './active-sessions';
import DeleteAlert from './delete-alert';
import GroupBreadcrumb from './group-breadcrumb';
import GroupCard from './group-card';
import GroupFormDialog from './group-form-dialog';
import HostCard from './host-card';
import HostFormSheet from './host-form-sheet';
import HostsEmptyState from './hosts-empty-state';
import HostsHeader from './hosts-header';
import HostsSearch from './hosts-search';
import SectionHeading from './section-heading';
import TagFilterBar from './tag-filter-bar';
import { useHostsBrowser } from '@/hooks/useHostsBrowser';

type HostSheetArgs = { host?: HostType; groupId: string | null };
type GroupDialogArgs =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'rename'; group: GroupType };
type DeleteTarget =
  { kind: 'group'; group: GroupType } | { kind: 'host'; host: HostType };

const GRID = 'grid gap-3 grid-cols-[repeat(auto-fill,minmax(232px,1fr))]';

export default function HostsPage() {
  const hosts = useAtomValue(hostsAtom);
  const groups = useAtomValue(groupsAtom);
  const allTags = useAtomValue(allTagsAtom);
  const tagFilter = useAtomValue(tagFilterAtom);
  const sessions = useAtomValue(sessionsAtom);
  const connect = useSetAtom(connectAtom);
  const refreshAll = useSetAtom(refreshAllAtom);
  const setActiveSession = useSetAtom(setActiveSessionAtom);
  const setTagFilter = useSetAtom(setTagFilterAtom);
  const navigate = useNavigate();

  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetArgs, setSheetArgs] = useState<HostSheetArgs>({ groupId: null });

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupDialogArgs, setGroupDialogArgs] = useState<GroupDialogArgs>({
    mode: 'create',
    parentId: null,
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const view = useHostsBrowser({ hosts, groups, path, query, tagFilter });

  const sessionByHostId = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) if (!map.has(s.hostId)) map.set(s.hostId, s.id);
    return map;
  }, [sessions]);

  const hostsById = useMemo(
    () => new Map(hosts.map((h) => [h.id, h])),
    [hosts],
  );

  const openCreateHost = (groupId: string | null) => {
    setSheetArgs({ host: undefined, groupId });
    setSheetOpen(true);
  };

  const openEditHost = (host: HostType) => {
    setSheetArgs({ host, groupId: null });
    setSheetOpen(true);
  };

  const openCreateGroup = () => {
    setGroupDialogArgs({ mode: 'create', parentId: view.currentGroupId });
    setGroupDialogOpen(true);
  };

  const openRenameGroup = (group: GroupType) => {
    setGroupDialogArgs({ mode: 'rename', group });
    setGroupDialogOpen(true);
  };

  const askDelete = (target: DeleteTarget) => {
    setDeleteTarget(target);
    setDeleteOpen(true);
  };

  const submitGroupDialog = async (name: string) => {
    if (groupDialogArgs.mode === 'create') {
      await hostsService.addGroup(name, groupDialogArgs.parentId);
    } else if (name !== groupDialogArgs.group.name) {
      await hostsService.renameGroup(groupDialogArgs.group.id, name);
    }
    await refreshAll();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'group') {
      await hostsService.deleteGroup(deleteTarget.group.id);
    } else {
      await hostsService.remove(deleteTarget.host.id);
    }
    await refreshAll();
  };

  const openSession = (sessionId: string) => {
    setActiveSession(sessionId);
    navigate({ to: '/sessions' });
  };

  const openHost = (host: HostType) => {
    const existing = sessionByHostId.get(host.id);
    if (existing) {
      openSession(existing);
      return;
    }
    void connect(host);
    navigate({ to: '/sessions' });
  };

  const showSessions =
    sessions.length > 0 && !view.insideGroup && !view.searching;

  return (
    <div className="bg-background flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-6 pt-6 pb-10">
        <HostsHeader
          hostCount={hosts.length}
          groupCount={view.rootGroupCount}
          sessionCount={sessions.length}
          onNewGroup={openCreateGroup}
          onNewHost={() => openCreateHost(view.currentGroupId)}
          showActions={!view.isEmpty}
        />

        {!view.isEmpty && <HostsSearch value={query} onChange={setQuery} />}

        <TagFilterBar
          tags={allTags}
          value={tagFilter}
          onChange={setTagFilter}
        />

        {view.insideGroup && (
          <GroupBreadcrumb
            trail={view.breadcrumb}
            onNavigate={(depth) => setPath(path.slice(0, depth))}
          />
        )}

        {view.subgroups.length > 0 && (
          <section className="mb-8">
            <SectionHeading
              trailing={`${view.subgroups.length} group${view.subgroups.length === 1 ? '' : 's'}`}
            >
              {view.insideGroup ? 'Subgroups' : 'Groups'}
            </SectionHeading>
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
          <HostsEmptyState
            onNewHost={() => openCreateHost(null)}
            onNewGroup={openCreateGroup}
          />
        ) : (
          <section>
            <div className={GRID}>
              {view.visibleHosts.map((host) => (
                <HostCard
                  key={host.id}
                  host={host}
                  connected={sessionByHostId.has(host.id)}
                  onConnect={() => openHost(host)}
                  onEdit={() => openEditHost(host)}
                  onDelete={() => askDelete({ kind: 'host', host })}
                />
              ))}
            </div>
          </section>
        )}

        {showSessions && (
          <section className="mt-9">
            <SectionHeading trailing={`${sessions.length} open`}>
              Active sessions
            </SectionHeading>
            <ActiveSessions
              sessions={sessions}
              hostsById={hostsById}
              onOpen={openSession}
            />
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
        initialValue={
          groupDialogArgs.mode === 'rename' ? groupDialogArgs.group.name : ''
        }
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
          confirmLabel={
            deleteTarget.kind === 'group' ? 'Delete group' : 'Delete server'
          }
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}

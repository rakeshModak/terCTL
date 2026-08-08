import { useMemo } from 'react';
import type { GroupType, HostType } from '@/types/host';

export interface HostsBrowserArgs {
  hosts: HostType[];
  groups: GroupType[];
  path: string[];
  query: string;
  tagFilter: string | null;
}

export interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

export interface HostsBrowserView {
  currentGroupId: string | null;
  currentGroup: GroupType | null;
  insideGroup: boolean;
  searching: boolean;
  subgroups: GroupType[];
  visibleHosts: HostType[];
  breadcrumb: BreadcrumbEntry[];
  rootGroupCount: number;
  isEmpty: boolean;
  countDescendants: (groupId: string) => number;
}

export function useHostsBrowser({
  hosts,
  groups,
  path,
  query,
  tagFilter,
}: HostsBrowserArgs): HostsBrowserView {
  const currentGroupId = path.length ? path[path.length - 1] : null;

  const countDescendants = useMemo(() => {
    const childrenOf = new Map<string | null, GroupType[]>();
    for (const g of groups) {
      const arr = childrenOf.get(g.parentId) ?? [];
      arr.push(g);
      childrenOf.set(g.parentId, arr);
    }
    const hostsByGroup = new Map<string | null, number>();
    for (const h of hosts) {
      hostsByGroup.set(h.groupId, (hostsByGroup.get(h.groupId) ?? 0) + 1);
    }
    const memo = new Map<string, number>();
    const count = (gid: string): number => {
      const cached = memo.get(gid);
      if (cached !== undefined) return cached;
      let n = hostsByGroup.get(gid) ?? 0;
      for (const child of childrenOf.get(gid) ?? []) n += count(child.id);
      memo.set(gid, n);
      return n;
    };
    return count;
  }, [groups, hosts]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const visibleHosts = useMemo(() => {
    const matchesQuery = (h: HostType) =>
      !q ||
      h.label.toLowerCase().includes(q) ||
      h.hostname.toLowerCase().includes(q) ||
      h.username.toLowerCase().includes(q) ||
      h.tags.some((t) => t.toLowerCase().includes(q));

    return hosts
      .filter((h) => searching || (h.groupId ?? null) === currentGroupId)
      .filter((h) => (tagFilter ? h.tags.includes(tagFilter) : true))
      .filter(matchesQuery);
  }, [hosts, q, searching, currentGroupId, tagFilter]);

  const subgroups = useMemo(
    () =>
      searching ? [] : groups.filter((g) => g.parentId === currentGroupId),
    [searching, groups, currentGroupId],
  );

  const breadcrumb = useMemo(() => {
    const trail: BreadcrumbEntry[] = [{ id: null, name: 'Hosts' }];
    for (const gid of path) {
      const g = groups.find((x) => x.id === gid);
      if (g) trail.push({ id: g.id, name: g.name });
    }
    return trail;
  }, [path, groups]);

  return {
    currentGroupId,
    currentGroup: currentGroupId
      ? (groups.find((g) => g.id === currentGroupId) ?? null)
      : null,
    insideGroup: path.length > 0,
    searching,
    subgroups,
    visibleHosts,
    breadcrumb,
    rootGroupCount: groups.filter((g) => g.parentId === null).length,
    isEmpty: !searching && hosts.length === 0 && groups.length === 0,
    countDescendants,
  };
}

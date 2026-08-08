export type AuthKindType = 'password' | 'key';

export interface HostType {
  id: string;
  label: string;
  hostname: string;
  port: number;
  username: string;
  authKind: AuthKindType;
  keyRef: string | null;
  groupId: string | null;
  tags: string[];
  /** Per-host appearance overrides; null = use the global setting. */
  accent: string | null;
  termScheme: string | null;
}

export interface NewHostType {
  label: string;
  hostname: string;
  port: number;
  username: string;
  authKind: AuthKindType;
  keyRef: string | null;
  groupId: string | null;
  tags: string[];
  accent: string | null;
  termScheme: string | null;
}

export interface GroupType {
  id: string;
  name: string;
  parentId: string | null;
}

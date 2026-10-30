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
  accent: string | null;
  termScheme: string | null;
  os: string | null;
  jumpHostId: string | null;
  /** Pinned to the Starred section. Not on NewHostType: new hosts start off. */
  starred: boolean;
  /** Outlines the terminal and confirms destructive commands. See lib/prodGuard. */
  production: boolean;
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
  jumpHostId: string | null;
  production: boolean;
}

export interface GroupType {
  id: string;
  name: string;
  parentId: string | null;
}

export type AuthKind = 'password' | 'key'

export interface Host {
  id: string
  label: string
  hostname: string
  port: number
  username: string
  authKind: AuthKind
  keyRef: string | null
  groupId: string | null
  tags: string[]
  /** Per-host appearance overrides; null = use the global setting. */
  accent: string | null
  termScheme: string | null
}

export interface NewHost {
  label: string
  hostname: string
  port: number
  username: string
  authKind: AuthKind
  keyRef: string | null
  groupId: string | null
  tags: string[]
  accent: string | null
  termScheme: string | null
}

export interface Group {
  id: string
  name: string
  parentId: string | null
}

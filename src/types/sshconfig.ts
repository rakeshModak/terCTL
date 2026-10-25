/** Mirrors `EntryStatus` in `sshconfig.rs`. */
export type SshConfigEntryStatusType =
  'new' | 'exists' | 'duplicate' | 'invalid';

/** One concrete `Host` alias from an OpenSSH config, already resolved. */
export interface SshConfigEntryType {
  alias: string;
  hostname: string;
  port: number;
  username: string;
  keyRef: string | null;
  /** The bastion as written in `ProxyJump`, if any. */
  jump: string | null;
  status: SshConfigEntryStatusType;
  /**
   * A bare name (no dots, not an IP) that didn't resolve from this machine.
   * Still importable, but left unticked — it's usually a typo or a leftover.
   */
  unresolved: boolean;
  /** Why an entry can't be imported, or what was left out of it. */
  notes: string[];
}

export interface SshConfigPreviewType {
  /** Absolute path that was read — pass it back unchanged to import. */
  path: string;
  entries: SshConfigEntryType[];
}

export interface SshConfigImportSummaryType {
  hostsAdded: number;
  jumpsLinked: number;
  /** Ticked but not imported: already present, duplicated, or invalid. */
  skipped: string[];
  /** Imported with no key file found, so they can't authenticate yet. */
  needsKey: string[];
  /** `alias: message` for anything imported with a setting dropped. */
  notes: string[];
}

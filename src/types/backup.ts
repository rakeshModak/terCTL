/** Counts shown before the user commits to an export. */
export interface BackupPreviewType {
  hosts: number;
  groups: number;
  passwords: number;
  passphrases: number;
  keyAuthHosts: number;
}

export interface BackupInfoType {
  version: number;
  createdAtUnix: number;
  appVersion: string;
}

export interface ExportSummaryType {
  path: string;
  hosts: number;
  groups: number;
  passwords: number;
  passphrases: number;
  privateKeys: number;
  /** Key-auth hosts whose key file could not be read at export time. */
  unreadableKeys: string[];
}

export interface ImportSummaryType {
  hostsAdded: number;
  groupsAdded: number;
  secretsRestored: number;
  privateKeysRestored: number;
  hostsSkippedExisting: number;
  hostsSkippedDuplicate: string[];
  fingerprintConflicts: string[];
  needsCredentials: string[];
}

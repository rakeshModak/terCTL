import { open } from '@tauri-apps/plugin-dialog';
import { call } from './config/tauri-api';
import type {
  SshConfigImportSummaryType,
  SshConfigPreviewType,
} from '@/types/sshconfig';

// Importing hosts from an OpenSSH client config. Parsing, validation and the
// insert all happen in Rust; this only passes a path and the chosen aliases.
export const sshConfigService = {
  /** Omit `path` to read `~/.ssh/config`. */
  preview: (path?: string) =>
    call<SshConfigPreviewType>('ssh_config_preview', { path: path ?? null }),

  // No extension filter: an SSH config is conventionally just `config`.
  choosePath: async () => {
    const picked = await open({
      title: 'Choose an SSH config file',
      multiple: false,
      directory: false,
    });
    return typeof picked === 'string' ? picked : null;
  },

  import: (path: string, aliases: string[]) =>
    call<SshConfigImportSummaryType>('ssh_config_import', { path, aliases }),
};

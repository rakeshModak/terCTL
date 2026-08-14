import { open, save } from '@tauri-apps/plugin-dialog';
import { call } from './config/tauri-api';
import type {
  BackupInfoType,
  BackupPreviewType,
  ExportSummaryType,
  ImportSummaryType,
} from '@/types/backup';

const FILTERS = [{ name: 'TerCTL backup', extensions: ['json'] }];

export const backupService = {
  preview: () => call<BackupPreviewType>('backup_preview'),

  chooseExportPath: () =>
    save({
      title: 'Export connections',
      defaultPath: 'terctl-connections.json',
      filters: FILTERS,
    }),

  chooseImportPath: async () => {
    const picked = await open({
      title: 'Import connections',
      multiple: false,
      directory: false,
      filters: FILTERS,
    });
    return typeof picked === 'string' ? picked : null;
  },

  inspect: (path: string) => call<BackupInfoType>('inspect_backup', { path }),

  export: (path: string, passphrase: string, includePrivateKeys: boolean) =>
    call<ExportSummaryType>('export_config', {
      path,
      passphrase,
      includePrivateKeys,
    }),

  import: (path: string, passphrase: string) =>
    call<ImportSummaryType>('import_config', { path, passphrase }),
};

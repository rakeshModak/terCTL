import { useState } from 'react';
import { Download, ShieldAlert, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { backupService } from '@/services/backup.service';
import SettingRow, { SettingRowList } from '@/modules/settings/setting-row';
import SettingsSection from '@/modules/settings/settings-section';
import ExportDialog from '@/modules/settings/sections/import-export/export-dialog';
import ImportDialog, {
  type PendingImport,
} from '@/modules/settings/sections/import-export/import-dialog';

export default function ImportExportSection() {
  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  async function handleImportClick() {
    setPickError(null);
    const path = await backupService.chooseImportPath();
    if (!path) return;
    try {
      const info = await backupService.inspect(path);
      setPending({ path, info });
    } catch (e) {
      setPickError(String(e));
    }
  }

  return (
    <SettingsSection
      title="Import & Export"
      description="Move your connections between machines as one encrypted file."
    >
      <Alert className="mb-5">
        <ShieldAlert />
        <AlertTitle>An export is a portable copy of your access</AlertTitle>
        <AlertDescription>
          Hosts, saved passwords, key passphrases, and optionally your private
          keys are sealed with XChaCha20-Poly1305 under an Argon2id key derived
          from the passphrase you choose. That passphrase is the only thing
          protecting the file, it cannot be recovered, and an exported file
          cannot be revoked.
        </AlertDescription>
      </Alert>

      <SettingRowList>
        <SettingRow
          title="Export connections"
          description="Encrypt every host, group, and stored secret into a single JSON file"
          action={
            <Button variant="outline" onClick={() => setExporting(true)}>
              <Download />
              Export
            </Button>
          }
        />
        <SettingRow
          title="Import connections"
          description="Add hosts from a backup file; existing entries are never overwritten"
          action={
            <Button variant="outline" onClick={handleImportClick}>
              <Upload />
              Import
            </Button>
          }
        />
      </SettingRowList>

      {pickError && (
        <p className="text-destructive mt-3 text-sm">{pickError}</p>
      )}

      <ExportDialog open={exporting} onOpenChange={setExporting} />
      <ImportDialog pending={pending} onClose={() => setPending(null)} />
    </SettingsSection>
  );
}

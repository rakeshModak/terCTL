import { useEffect, useState } from 'react';
import { AlertTriangle, KeyRound, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { backupService } from '@/services/backup.service';
import type { BackupPreviewType, ExportSummaryType } from '@/types/backup';
import PassphraseField from '@/modules/settings/sections/import-export/passphrase-field';
import {
  MIN_PASSPHRASE_LENGTH,
  ratePassphrase,
} from '@/modules/settings/sections/import-export/passphrase-strength';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExportDialog({
  open,
  onOpenChange,
}: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <ExportDialogBody onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ExportDialogBody({ onDone }: { onDone: () => void }) {
  const [preview, setPreview] = useState<BackupPreviewType | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [includeKeys, setIncludeKeys] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ExportSummaryType | null>(null);

  useEffect(() => {
    backupService
      .preview()
      .then(setPreview)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(
    () => () => {
      setPassphrase('');
      setConfirm('');
    },
    [],
  );

  const strength = ratePassphrase(passphrase);
  const mismatch = confirm.length > 0 && confirm !== passphrase;
  const ready =
    passphrase.length >= MIN_PASSPHRASE_LENGTH &&
    confirm === passphrase &&
    !busy;

  async function handleExport() {
    setError(null);
    const path = await backupService.chooseExportPath();
    if (!path) return;

    setBusy(true);
    try {
      const result = await backupService.export(path, passphrase, includeKeys);
      setSummary(result);
      setPassphrase('');
      setConfirm('');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (summary) {
    return <ExportResult summary={summary} onDone={onDone} />;
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Export connections</DialogTitle>
        <DialogDescription>
          {preview
            ? `${preview.hosts} host${preview.hosts === 1 ? '' : 's'}, ${preview.groups} group${preview.groups === 1 ? '' : 's'}, ${preview.passwords} saved password${preview.passwords === 1 ? '' : 's'}, and ${preview.passphrases} key passphrase${preview.passphrases === 1 ? '' : 's'} will be encrypted into one file.`
            : 'Reading your connections…'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <PassphraseField
          label="Encryption passphrase"
          value={passphrase}
          onChange={setPassphrase}
          reveal={reveal}
          onToggleReveal={() => setReveal((r) => !r)}
          showStrength
          autoFocus
        />
        <PassphraseField
          label="Confirm passphrase"
          value={confirm}
          onChange={setConfirm}
          reveal={reveal}
          onToggleReveal={() => setReveal((r) => !r)}
          error={mismatch ? 'Passphrases do not match.' : null}
        />

        {preview && preview.keyAuthHosts > 0 && (
          <div className="border-border flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="include-keys"
              checked={includeKeys}
              onCheckedChange={(checked) => setIncludeKeys(checked === true)}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="include-keys" className="font-medium">
                Include private keys ({preview.keyAuthHosts} host
                {preview.keyAuthHosts === 1 ? '' : 's'})
              </Label>
              <p className="text-muted-foreground text-xs">
                Required to connect from a machine that doesn&apos;t already
                have your SSH keys. Without this, key-based hosts import but
                cannot authenticate.
              </p>
            </div>
          </div>
        )}

        {includeKeys && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>This file becomes as powerful as your keys</AlertTitle>
            <AlertDescription>
              Anyone who obtains it and guesses the passphrase gains the same
              server access you have. There is no way to revoke an exported file
              — if it leaks, you must rotate credentials on the servers
              themselves.
            </AlertDescription>
          </Alert>
        )}

        {passphrase.length >= MIN_PASSPHRASE_LENGTH && strength.score <= 1 && (
          <Alert>
            <KeyRound />
            <AlertTitle>Weak passphrase</AlertTitle>
            <AlertDescription>
              A backup file can be attacked offline indefinitely, with no rate
              limit. Length matters more than symbols.
            </AlertDescription>
          </Alert>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleExport} disabled={!ready}>
          {busy && <Loader2 className="animate-spin" />}
          {busy ? 'Encrypting…' : 'Choose location & export'}
        </Button>
      </DialogFooter>
    </>
  );
}

function ExportResult({
  summary,
  onDone,
}: {
  summary: ExportSummaryType;
  onDone: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Export complete</DialogTitle>
        <DialogDescription className="break-all">
          {summary.path}
        </DialogDescription>
      </DialogHeader>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Hosts</dt>
        <dd className="text-right tabular-nums">{summary.hosts}</dd>
        <dt className="text-muted-foreground">Groups</dt>
        <dd className="text-right tabular-nums">{summary.groups}</dd>
        <dt className="text-muted-foreground">Passwords</dt>
        <dd className="text-right tabular-nums">{summary.passwords}</dd>
        <dt className="text-muted-foreground">Key passphrases</dt>
        <dd className="text-right tabular-nums">{summary.passphrases}</dd>
        <dt className="text-muted-foreground">Private keys</dt>
        <dd className="text-right tabular-nums">{summary.privateKeys}</dd>
      </dl>

      {summary.unreadableKeys.length > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>
            {summary.unreadableKeys.length} key could not be read
          </AlertTitle>
          <AlertDescription>
            {summary.unreadableKeys.join(', ')} — the key file is missing,
            unreadable, or held only by an agent or hardware token. These hosts
            will need their key supplied manually after import.
          </AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
}

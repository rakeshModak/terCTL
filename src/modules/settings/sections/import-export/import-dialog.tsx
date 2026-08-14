import { useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { backupService } from '@/services/backup.service';
import { refreshAllAtom } from '@/store/app';
import type { BackupInfoType, ImportSummaryType } from '@/types/backup';
import PassphraseField from '@/modules/settings/sections/import-export/passphrase-field';

export interface PendingImport {
  path: string;
  info: BackupInfoType;
}

interface ImportDialogProps {
  pending: PendingImport | null;
  onClose: () => void;
}

export default function ImportDialog({ pending, onClose }: ImportDialogProps) {
  return (
    <Dialog open={Boolean(pending)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {pending && <ImportDialogBody pending={pending} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ImportDialogBody({
  pending,
  onDone,
}: {
  pending: PendingImport;
  onDone: () => void;
}) {
  const refreshAll = useSetAtom(refreshAllAtom);
  const [passphrase, setPassphrase] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummaryType | null>(null);

  useEffect(() => () => setPassphrase(''), []);

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      const result = await backupService.import(pending.path, passphrase);
      setPassphrase('');
      setSummary(result);
      await refreshAll();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (summary) {
    return <ImportResult summary={summary} onDone={onDone} />;
  }

  const created = new Date(pending.info.createdAtUnix * 1000);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import connections</DialogTitle>
        <DialogDescription>
          TerCTL backup from {created.toLocaleDateString()} (app version{' '}
          {pending.info.appVersion}). Imported hosts are added to your existing
          ones — nothing already saved is modified or removed.
        </DialogDescription>
      </DialogHeader>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (passphrase && !busy) void handleImport();
        }}
      >
        <PassphraseField
          label="Decryption passphrase"
          value={passphrase}
          onChange={setPassphrase}
          reveal={reveal}
          onToggleReveal={() => setReveal((r) => !r)}
          autoFocus
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
      </form>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleImport} disabled={!passphrase || busy}>
          {busy && <Loader2 className="animate-spin" />}
          {busy ? 'Decrypting…' : 'Import'}
        </Button>
      </DialogFooter>
    </>
  );
}

function ImportResult({
  summary,
  onDone,
}: {
  summary: ImportSummaryType;
  onDone: () => void;
}) {
  const skipped =
    summary.hostsSkippedExisting + summary.hostsSkippedDuplicate.length;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import complete</DialogTitle>
        <DialogDescription>
          {summary.hostsAdded} host{summary.hostsAdded === 1 ? '' : 's'} added
          {skipped > 0 && `, ${skipped} skipped as already present`}.
        </DialogDescription>
      </DialogHeader>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Hosts added</dt>
        <dd className="text-right tabular-nums">{summary.hostsAdded}</dd>
        <dt className="text-muted-foreground">Groups added</dt>
        <dd className="text-right tabular-nums">{summary.groupsAdded}</dd>
        <dt className="text-muted-foreground">Secrets restored</dt>
        <dd className="text-right tabular-nums">{summary.secretsRestored}</dd>
        <dt className="text-muted-foreground">Private keys restored</dt>
        <dd className="text-right tabular-nums">
          {summary.privateKeysRestored}
        </dd>
      </dl>

      {summary.hostsSkippedDuplicate.length > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Skipped as duplicates</AlertTitle>
          <AlertDescription>
            {summary.hostsSkippedDuplicate.join(', ')} — already saved under a
            different entry with the same host, port, and username. Your
            existing settings were kept.
          </AlertDescription>
        </Alert>
      )}

      {summary.fingerprintConflicts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Host key mismatch</AlertTitle>
          <AlertDescription>
            {summary.fingerprintConflicts.join(', ')} — the backup pins a
            different server key than the one you already trust. Your local pin
            was kept. Investigate before connecting: this is what a
            man-in-the-middle would look like.
          </AlertDescription>
        </Alert>
      )}

      {summary.needsCredentials.length > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Key material missing</AlertTitle>
          <AlertDescription>
            {summary.needsCredentials.join(', ')} — imported without a private
            key, so they cannot authenticate on this machine yet. Re-export with
            &ldquo;Include private keys&rdquo; enabled, or point each host at a
            key file.
          </AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
}

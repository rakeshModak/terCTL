import { useCallback, useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import {
  AlertTriangle,
  CornerDownRight,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { sshConfigService } from '@/services/sshconfig.service';
import { refreshAllAtom } from '@/store/app';
import type {
  SshConfigEntryStatusType,
  SshConfigEntryType,
  SshConfigImportSummaryType,
  SshConfigPreviewType,
} from '@/types/sshconfig';

interface SshConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_LABEL: Record<Exclude<SshConfigEntryStatusType, 'new'>, string> = {
  exists: 'Already saved',
  duplicate: 'Duplicate',
  invalid: 'Invalid',
};

export default function SshConfigDialog({
  open,
  onClose,
}: SshConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {open && <SshConfigDialogBody onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function SshConfigDialogBody({ onDone }: { onDone: () => void }) {
  const refreshAll = useSetAtom(refreshAllAtom);
  const [preview, setPreview] = useState<SshConfigPreviewType | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SshConfigImportSummaryType | null>(
    null,
  );

  // Handed to `.then` / `.catch` rather than called from the effect body, the
  // same shape export-dialog uses, so state is only ever set from a settled
  // promise and never synchronously while the effect runs.
  const applyPreview = useCallback((result: SshConfigPreviewType) => {
    setPreview(result);
    // Start ticked only if importable and, for bare names, resolvable — so a
    // leftover entry is shown but has to be opted into.
    setSelected(
      new Set(
        result.entries
          .filter((e) => e.status === 'new' && !e.unresolved)
          .map((e) => e.alias),
      ),
    );
    setLoadError(null);
    setLoading(false);
  }, []);

  const applyLoadError = useCallback((e: unknown) => {
    setPreview(null);
    setLoadError(String(e));
    setLoading(false);
  }, []);

  useEffect(() => {
    sshConfigService.preview().then(applyPreview).catch(applyLoadError);
  }, [applyPreview, applyLoadError]);

  async function handleChooseFile() {
    const path = await sshConfigService.choosePath();
    if (!path) return;
    setLoading(true);
    await sshConfigService
      .preview(path)
      .then(applyPreview)
      .catch(applyLoadError);
  }

  async function handleImport() {
    if (!preview) return;
    setBusy(true);
    setImportError(null);
    try {
      const result = await sshConfigService.import(preview.path, [...selected]);
      setSummary(result);
      await refreshAll();
    } catch (e) {
      setImportError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (summary) {
    return <ImportResult summary={summary} onDone={onDone} />;
  }

  const importable = preview?.entries.filter((e) => e.status === 'new') ?? [];
  const allSelected =
    importable.length > 0 && importable.every((e) => selected.has(e.alias));

  const toggle = (alias: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(alias);
      else next.delete(alias);
      return next;
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import from SSH config</DialogTitle>
        <DialogDescription>
          Hosts are added alongside your existing ones — nothing already saved
          is modified. Key files are referenced by path; no keys or passwords
          are read.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2">
        <span
          className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs"
          title={preview?.path}
        >
          {preview?.path ?? '~/.ssh/config'}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleChooseFile}
          disabled={loading || busy}
        >
          <FolderOpen />
          Choose file…
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Reading config…
        </div>
      ) : loadError ? (
        <p className="text-destructive py-6 text-center text-sm">{loadError}</p>
      ) : preview && preview.entries.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No hosts found in this config.
        </p>
      ) : (
        preview && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-3">
              <Checkbox
                id="ssh-config-all"
                checked={allSelected}
                disabled={importable.length === 0 || busy}
                onCheckedChange={(value) =>
                  setSelected(
                    value === true
                      ? new Set(importable.map((e) => e.alias))
                      : new Set(),
                  )
                }
              />
              <Label
                htmlFor="ssh-config-all"
                className="text-muted-foreground text-xs"
              >
                {importable.length} of {preview.entries.length} can be imported
              </Label>
            </div>

            <div className="border-border max-h-80 overflow-y-auto rounded-lg border">
              {preview.entries.map((entry, i) => (
                <EntryRow
                  key={entry.alias}
                  index={i}
                  entry={entry}
                  checked={selected.has(entry.alias)}
                  disabled={busy}
                  onCheckedChange={(on) => toggle(entry.alias, on)}
                />
              ))}
            </div>
          </div>
        )
      )}

      {importError && <p className="text-destructive text-sm">{importError}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={loading || busy || selected.size === 0}
        >
          {busy && <Loader2 className="animate-spin" />}
          {busy
            ? 'Importing…'
            : `Import ${selected.size} host${selected.size === 1 ? '' : 's'}`}
        </Button>
      </DialogFooter>
    </>
  );
}

function EntryRow({
  index,
  entry,
  checked,
  disabled,
  onCheckedChange,
}: {
  index: number;
  entry: SshConfigEntryType;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const importable = entry.status === 'new';
  // Aliases can hold characters that are awkward in an id; the position isn't.
  const id = `ssh-config-entry-${index}`;

  return (
    <div
      className={cn(
        'border-border flex items-start gap-3 border-b px-3 py-2.5 last:border-b-0',
        !importable && 'opacity-60',
      )}
    >
      <Checkbox
        id={id}
        checked={importable && checked}
        disabled={!importable || disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="truncate font-medium">
            {entry.alias}
          </Label>
          {/* Checked on `entry.status` itself so TypeScript narrows out 'new'. */}
          {entry.status !== 'new' && (
            <Badge variant="secondary" className="shrink-0">
              {STATUS_LABEL[entry.status]}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-2xs truncate font-mono">
          {entry.username}@{entry.hostname}:{entry.port}
        </p>
        {entry.jump && (
          <p className="text-muted-foreground text-2xs flex items-center gap-1 truncate font-mono">
            <CornerDownRight className="size-2.5 shrink-0" />
            <span className="truncate">via {entry.jump}</span>
          </p>
        )}
        {entry.notes.map((note) => (
          <p
            key={note}
            className={cn(
              'text-xs',
              entry.status === 'invalid'
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
          >
            {note}
          </p>
        ))}
      </div>
    </div>
  );
}

function ImportResult({
  summary,
  onDone,
}: {
  summary: SshConfigImportSummaryType;
  onDone: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Import complete</DialogTitle>
        <DialogDescription>
          {summary.hostsAdded} host{summary.hostsAdded === 1 ? '' : 's'} added
          {summary.skipped.length > 0 &&
            `, ${summary.skipped.length} skipped as already present or invalid`}
          .
        </DialogDescription>
      </DialogHeader>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Hosts added</dt>
        <dd className="text-right tabular-nums">{summary.hostsAdded}</dd>
        <dt className="text-muted-foreground">Jump hosts linked</dt>
        <dd className="text-right tabular-nums">{summary.jumpsLinked}</dd>
      </dl>

      {summary.needsKey.length > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>No key file found</AlertTitle>
          <AlertDescription>
            {summary.needsKey.join(', ')} — imported without a key, so they
            can&apos;t authenticate yet. Edit each host and point it at a key
            file.
          </AlertDescription>
        </Alert>
      )}

      {summary.notes.length > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Imported with changes</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {summary.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
}

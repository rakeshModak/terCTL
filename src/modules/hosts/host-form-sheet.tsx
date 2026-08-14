import { useState, type FormEvent } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { TagInput } from '@/components/ui/tag-input';
import {
  allTagsAtom,
  groupsAtom,
  hostsAtom,
  refreshAllAtom,
} from '../../store/app';
import { credentialsService } from '../../services/credentials.service';
import { hostsService } from '../../services/hosts.service';
import type { AuthKindType, HostType } from '@/types/host';
import GroupFormDialog from './group-form-dialog';
import TermSchemeSelect from './term-scheme-select';

const UNGROUPED = '__ungrouped__';
const NEW_GROUP = '__new_group__';
const DIRECT = '__direct__';

interface HostFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  host?: HostType;
  defaultGroupId: string | null;
}

export default function HostFormSheet({
  open,
  onOpenChange,
  host,
  defaultGroupId,
}: HostFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 data-[side=right]:sm:max-w-md"
      >
        <HostFormBody
          host={host}
          defaultGroupId={defaultGroupId}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

interface HostFormBodyProps {
  host?: HostType;
  defaultGroupId: string | null;
  onDone: () => void;
}

function HostFormBody({ host, defaultGroupId, onDone }: HostFormBodyProps) {
  const groups = useAtomValue(groupsAtom);
  const allTags = useAtomValue(allTagsAtom);
  const hosts = useAtomValue(hostsAtom);
  const refreshAll = useSetAtom(refreshAllAtom);

  const [label, setLabel] = useState(host?.label ?? '');
  const [hostname, setHostname] = useState(host?.hostname ?? '');
  const [port, setPort] = useState(String(host?.port ?? 22));
  const [username, setUsername] = useState(host?.username ?? 'root');
  const [authKind, setAuthKind] = useState<AuthKindType>(
    host?.authKind ?? 'key',
  );
  const [keyPath, setKeyPath] = useState(host?.keyRef ?? '~/.ssh/id_ed25519');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [groupId, setGroupId] = useState<string | null>(
    host?.groupId ?? defaultGroupId,
  );
  const [tags, setTags] = useState<string[]>(host?.tags ?? []);
  const [termScheme, setTermScheme] = useState<string | null>(
    host?.termScheme ?? null,
  );
  const [jumpHostId, setJumpHostId] = useState<string | null>(
    host?.jumpHostId ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  // Excluding self only stops the one-hop loop; a longer cycle is still
  // possible to configure, and `connect_host` rejects it with the chain named.
  const jumpCandidates = hosts.filter((h) => h.id !== host?.id);

  const handleCreateGroup = async (name: string) => {
    const group = await hostsService.addGroup(name);
    await refreshAll();
    setGroupId(group.id);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const shared = {
        label: label || `${username}@${hostname}`,
        hostname,
        port: Number(port),
        username,
        authKind,
        keyRef: authKind === 'key' ? keyPath : null,
        groupId,
        tags,
        accent: null,
        termScheme,
        jumpHostId,
      };

      let savedId: string;
      if (host) {
        await hostsService.update({ ...host, ...shared });
        savedId = host.id;
      } else {
        savedId = (await hostsService.add(shared)).id;
      }

      if (authKind === 'key' && passphrase) {
        await credentialsService.save(savedId, 'passphrase', passphrase);
      }
      if (authKind === 'password' && password) {
        await credentialsService.save(savedId, 'password', password);
      }

      await refreshAll();
      onDone();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
        {/* pr-12 clears the sheet's built-in close button at top-4 right-4. */}
        <SheetHeader className="flex-row items-center gap-3 border-b p-4 pr-12">
          <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <TerminalSquare className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle>{host ? 'Edit server' : 'Add server'}</SheetTitle>
            <SheetDescription>SSH connection details</SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <Input
            label="Label"
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
            placeholder="api"
          />

          <div className="flex gap-3">
            <Input
              label="Host"
              value={hostname}
              onChange={(e) => setHostname(e.currentTarget.value)}
              placeholder="203.0.113.10"
              required
            />
            <div className="w-24 shrink-0">
              <Input
                label="Port"
                inputMode="numeric"
                value={port}
                onChange={(e) => setPort(e.currentTarget.value)}
              />
            </div>
          </div>

          <Input
            label="User"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            required
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="host-auth">Auth</Label>
            <Select
              value={authKind}
              onValueChange={(value: AuthKindType | null) =>
                value && setAuthKind(value)
              }
              items={[
                { value: 'key', label: 'Private key' },
                { value: 'password', label: 'Password' },
              ]}
            >
              <SelectTrigger
                id="host-auth"
                className="w-full data-[size=default]:h-9"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="key">Private key</SelectItem>
                <SelectItem value="password">Password</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {authKind === 'key' ? (
            <>
              <Input
                label="Key path"
                value={keyPath}
                onChange={(e) => setKeyPath(e.currentTarget.value)}
              />
              <Input
                label="Passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.currentTarget.value)}
                placeholder={
                  host ? '(leave blank to keep current)' : '(optional)'
                }
              />
            </>
          ) : (
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              placeholder={host ? '(leave blank to keep current)' : ''}
            />
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="host-group">Group</Label>
            <Select
              value={groupId ?? UNGROUPED}
              onValueChange={(value: string | null) => {
                if (value === NEW_GROUP) {
                  setGroupDialogOpen(true);
                  return;
                }
                setGroupId(!value || value === UNGROUPED ? null : value);
              }}
              items={[
                { value: UNGROUPED, label: 'Ungrouped' },
                ...groups.map((g) => ({ value: g.id, label: g.name })),
                { value: NEW_GROUP, label: 'New group…' },
              ]}
            >
              <SelectTrigger
                id="host-group"
                className="w-full data-[size=default]:h-9"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNGROUPED}>Ungrouped</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value={NEW_GROUP}>New group…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TagInput
            label="Tags"
            value={tags}
            onChange={setTags}
            suggestions={allTags}
            placeholder="prod, db…"
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="host-jump">Connect via</Label>
            <Select
              value={jumpHostId ?? DIRECT}
              onValueChange={(value: string | null) =>
                setJumpHostId(!value || value === DIRECT ? null : value)
              }
              items={[
                { value: DIRECT, label: 'Direct connection' },
                ...jumpCandidates.map((h) => ({ value: h.id, label: h.label })),
              ]}
            >
              <SelectTrigger
                id="host-jump"
                className="w-full data-[size=default]:h-9"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DIRECT}>Direct connection</SelectItem>
                {jumpCandidates.length > 0 && <SelectSeparator />}
                {jumpCandidates.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Reach this host through a bastion, the way <code>ssh -J</code>
              {' '}does. Each hop authenticates on its own.
            </p>
          </div>

          <TermSchemeSelect value={termScheme} onChange={setTermScheme} />

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <SheetFooter className="flex-row justify-end border-t p-4">
          <SheetClose render={<Button type="button" variant="outline" />}>
            Cancel
          </SheetClose>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </form>

      {/* Deliberately a sibling of the form, not a child. The dialog renders
          its own <form>, and React bubbles events through the component tree
          even across a portal — nested, submitting it would submit this one. */}
      <GroupFormDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        title="New group"
        description="Groups keep related servers together."
        confirmLabel="Create"
        placeholder="e.g. Production"
        onSubmit={(name) => void handleCreateGroup(name)}
      />
    </>
  );
}

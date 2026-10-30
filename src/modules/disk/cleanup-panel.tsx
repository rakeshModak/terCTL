import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Boxes,
  Check,
  CheckCircle2,
  Container,
  Database,
  TerminalSquare,
  FileText,
  Layers,
  Package,
  ScrollText,
  ShieldAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatKb } from '@/lib/format';
import { diskService } from '@/services/disk.service';
import { TerctlLoader } from '@/components/chrome/TerctlLogo';
import type {
  CleanupActionType,
  CleanupIdType,
  CleanupItemType,
  CleanupReportType,
  CleanupScanType,
} from '@/types/disk';
import DiskOverview from './disk-overview';

type Risk = 'safe' | 'caution' | 'danger';

interface Meta {
  label: string;
  description: string;
  risk: Risk;
  icon: LucideIcon;
  /** Can work without root: Docker through the `docker` group, PM2 for the
      login user's own logs. Everything else needs it. */
  rootless?: boolean;
}

const META: Record<CleanupIdType, Meta> = {
  journal: {
    label: 'Old journal logs',
    description: 'Keeps the newest 200 MB of system logs.',
    risk: 'safe',
    icon: ScrollText,
  },
  rotated_logs: {
    label: 'Rotated old logs',
    description:
      'Compressed and numbered copies older than 7 days. Live logs are untouched.',
    risk: 'safe',
    icon: Archive,
  },
  package_cache: {
    label: 'Package cache',
    description: 'Downloaded installers. Fetched again when needed.',
    risk: 'safe',
    icon: Package,
  },
  docker_build_cache: {
    label: 'Docker build cache',
    description:
      'Layers left over from image builds. The next build may be slower.',
    risk: 'safe',
    icon: Layers,
    rootless: true,
  },
  docker_images: {
    label: 'Unused Docker images',
    description: 'Untagged leftovers only. Tagged images stay.',
    risk: 'safe',
    icon: Boxes,
    rootless: true,
  },
  docker_containers: {
    label: 'Stopped Docker containers',
    description:
      'Containers that aren’t running, with their logs and any changes inside them.',
    risk: 'caution',
    icon: Container,
    rootless: true,
  },
  docker_volumes: {
    label: 'Unused Docker volumes',
    description:
      'Volumes no container is using. They can hold database data — tick only the ones you’re sure about.',
    risk: 'danger',
    icon: Database,
    rootless: true,
  },
  pm2_logs: {
    label: 'PM2 logs',
    description:
      'Empties the out and error logs of PM2 apps and removes old rotated copies. Apps keep running and logging.',
    risk: 'caution',
    icon: TerminalSquare,
    rootless: true,
  },
  truncate_logs: {
    label: 'Large live logs',
    description:
      'Empties logs over 500 MB. The app keeps logging, but the history is gone.',
    risk: 'caution',
    icon: FileText,
  },
};

const RISK_BADGE: Record<Exclude<Risk, 'safe'>, string> = {
  caution: 'Careful',
  danger: 'Can lose data',
};

type Stage = 'pick' | 'review' | 'running' | 'done';

interface CleanupPanelProps {
  hostId: string;
  /** Named in the final confirmation, so it's clear which server is cleaned. */
  hostLabel: string;
  /** Disk numbers from the map, for the before/after preview. */
  disk: { usedKb: number; totalKb: number } | null;
  onBack: () => void;
  /** Something was removed, so cached folder sizes are stale. */
  onCleaned: () => void;
}

export default function CleanupPanel({
  hostId,
  hostLabel,
  disk: diskProp,
  onBack,
  onCleaned,
}: CleanupPanelProps) {
  const [scan, setScan] = useState<CleanupScanType | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('pick');
  // Safe items start ticked; anything that can cost data must be opted into.
  const [picked, setPicked] = useState<Set<CleanupIdType>>(new Set());
  const [volumes, setVolumes] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<CleanupReportType | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  // The last stop before anything is deleted: the review shows the commands,
  // this asks once more with the server named.
  const [confirming, setConfirming] = useState(false);
  // A cleanup clears the map's cache, which takes its disk numbers with it;
  // the snapshot keeps the before/after story intact on the result screen.
  const [disk] = useState(diskProp);

  useEffect(() => {
    // State is only set from the settled promise, never synchronously here.
    diskService
      .scanCleanup(hostId)
      .then((s) => {
        setScan(s);
        setPicked(
          new Set(
            s.items
              .filter((i) => META[i.id].risk === 'safe' && usable(s, i))
              .map((i) => i.id),
          ),
        );
      })
      .catch((e) => setScanError(String(e)));
  }, [hostId]);

  const selected = useMemo(
    () =>
      (scan?.items ?? []).filter((i) => {
        if (i.id === 'docker_volumes') return volumes.size > 0;
        if (i.id === 'truncate_logs') return files.size > 0;
        return picked.has(i.id);
      }),
    [scan, picked, volumes, files],
  );

  const estimate = selected.reduce(
    (sum, i) => sum + frees(i, volumes, files),
    0,
  );

  const toggle = (id: CleanupIdType, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const run = () => {
    const actions: CleanupActionType[] = selected.map((i) =>
      i.id === 'docker_volumes'
        ? { id: i.id, names: [...volumes] }
        : i.id === 'truncate_logs'
          ? { id: i.id, paths: [...files] }
          : { id: i.id },
    );
    setStage('running');
    diskService
      .runCleanup(hostId, actions)
      .then((r) => {
        setReport(r);
        setStage('done');
        onCleaned();
      })
      .catch((e) => {
        setRunError(String(e));
        setStage('review');
      });
  };

  const back = (
    <Button variant="ghost" size="xs" onClick={onBack}>
      <ArrowLeft />
      Back to map
    </Button>
  );

  const overview = disk && (
    <DiskOverview
      usedKb={disk.usedKb}
      totalKb={disk.totalKb}
      freeingKb={stage === 'pick' || stage === 'review' ? estimate : 0}
    />
  );

  if (scanError) {
    return (
      <Shell>
        <Centered className="text-destructive">
          <AlertTriangle className="size-6" />
          <span className="[overflow-wrap:anywhere]">{scanError}</span>
        </Centered>
        <Footer>{back}</Footer>
      </Shell>
    );
  }

  if (!scan) {
    return (
      <Shell>
        <Centered>
          <TerctlLoader size={54} glow={false} />
          <span className="text-foreground">Checking what can be cleaned…</span>
          <span className="text-xs">Only measuring — nothing is deleted.</span>
        </Centered>
        <Footer>{back}</Footer>
      </Shell>
    );
  }

  if (stage === 'running') {
    return (
      <Shell>
        <Centered>
          <TerctlLoader size={54} glow={false} />
          <span className="text-foreground">Cleaning up…</span>
          <span className="text-xs">
            This can take a few minutes. Keep this window open.
          </span>
        </Centered>
      </Shell>
    );
  }

  if (stage === 'done' && report) {
    const failed = report.outcomes.filter((o) => !o.ok).length;
    const nowPct =
      disk && disk.totalKb
        ? ((disk.usedKb - Math.min(report.freedKb, disk.usedKb)) /
            disk.totalKb) *
          100
        : null;
    const wasPct =
      disk && disk.totalKb ? (disk.usedKb / disk.totalKb) * 100 : null;
    return (
      <Shell>
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <span
            className={cn(
              'flex size-12 items-center justify-center rounded-full',
              failed && !report.freedKb
                ? 'bg-destructive/10 text-destructive'
                : 'bg-(--green)/12 text-(--green)',
            )}
          >
            {failed && !report.freedKb ? (
              <XCircle className="size-6" />
            ) : (
              <Check className="size-6" />
            )}
          </span>
          <div className="font-heading text-2xl font-semibold tabular-nums">
            Freed {formatKb(report.freedKb)}
          </div>
          <p className="text-muted-foreground text-xs">
            {nowPct !== null && wasPct !== null
              ? `Disk went from ${Math.round(wasPct)}% to ${Math.round(nowPct)}%`
              : 'Measured on the root disk before and after.'}
            {failed > 0 &&
              ` · ${failed} step${failed === 1 ? '' : 's'} didn’t finish`}
          </p>
        </div>
        <ul className="border-border divide-border divide-y rounded-xl border">
          {report.outcomes.map((o) => {
            const Icon = META[o.id]?.icon ?? FileText;
            return (
              <li key={o.id} className="flex items-start gap-3 px-3 py-2.5">
                <IconTile icon={Icon} tone={o.ok ? 'muted' : 'danger'} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {META[o.id]?.label ?? o.id}
                  </div>
                  {o.message && (
                    <div className="text-muted-foreground mt-0.5 font-mono text-[11px] [overflow-wrap:anywhere]">
                      {o.message}
                    </div>
                  )}
                </div>
                {o.ok ? (
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-(--green)" />
                ) : (
                  <XCircle className="text-destructive mt-1 size-4 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
        <Footer>{back}</Footer>
      </Shell>
    );
  }

  if (stage === 'review') {
    const risky = selected.filter((i) => META[i.id].risk !== 'safe');
    return (
      <Shell>
        {overview}
        <div>
          <p className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
            Will run{scan.privilege === 'sudo' ? ' with sudo' : ''}
          </p>
          <ul className="bg-muted/45 border-border flex flex-col gap-1.5 rounded-xl border p-3 font-mono text-xs">
            {selected.map((i) => (
              <li key={i.id} className="flex gap-2 [overflow-wrap:anywhere]">
                <span className="text-primary shrink-0 select-none">$</span>
                <span className="min-w-0">{commandFor(i, volumes, files)}</span>
              </li>
            ))}
          </ul>
        </div>
        {risky.length > 0 && (
          <div className="border-destructive/40 bg-destructive/8 text-destructive flex items-start gap-2 rounded-xl border p-3 text-xs">
            <ShieldAlert className="size-4 shrink-0" />
            <span>
              {risky.map((i) => META[i.id].label).join(' and ')} can’t be
              undone.
            </span>
          </div>
        )}
        {runError && (
          <p className="text-destructive text-xs [overflow-wrap:anywhere]">
            {runError}
          </p>
        )}
        <Footer>
          <Button variant="ghost" size="sm" onClick={() => setStage('pick')}>
            <ArrowLeft />
            Change selection
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirming(true)}
          >
            Clean up about {formatKb(estimate)}
          </Button>
        </Footer>

        {/* The UI kit draws no backdrop for a nested dialog, which left the
            alert looking pasted onto this one. Dim the disk dialog instead;
            it's positioned and clips overflow, so this covers it exactly. */}
        {confirming && (
          <div
            aria-hidden="true"
            className="animate-in fade-in-0 absolute inset-0 z-40 bg-black/45 duration-100"
          />
        )}

        {/* Rendered inside the disk dialog's tree so it stacks above it as a
            nested dialog rather than competing with it for focus. */}
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <ShieldAlert />
              </AlertDialogMedia>
              <AlertDialogTitle className="[overflow-wrap:anywhere]">
                Clean up {hostLabel}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selected.length} cleanup{selected.length === 1 ? '' : 's'} will
                run on the server and free about {formatKb(estimate)}.{' '}
                {risky.length > 0
                  ? `${risky.map((i) => META[i.id].label).join(' and ')} can’t be undone.`
                  : 'Removed files can’t be restored.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  setConfirming(false);
                  run();
                }}
              >
                Yes, clean up
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Shell>
    );
  }

  const groups: { title: string; hint: string; items: CleanupItemType[] }[] = [
    {
      title: 'Safe to remove',
      hint: 'Old copies and caches. Nothing running depends on them.',
      items: scan.items.filter((i) => META[i.id].risk === 'safe'),
    },
    {
      title: 'Look before you tick',
      hint: 'These remove things you might still want.',
      items: scan.items.filter((i) => META[i.id].risk !== 'safe'),
    },
  ];

  const rowProps = (item: CleanupItemType) => ({
    item,
    disabled: !usable(scan, item),
    checked:
      item.id === 'docker_volumes'
        ? volumes.size > 0
        : item.id === 'truncate_logs'
          ? files.size > 0
          : picked.has(item.id),
    onToggle: (on: boolean) => {
      if (item.id === 'docker_volumes')
        setVolumes(new Set(on ? item.names : []));
      else if (item.id === 'truncate_logs')
        setFiles(new Set(on ? item.files.map((f) => f.path) : []));
      else toggle(item.id, on);
    },
    chosen: item.id === 'docker_volumes' ? volumes : files,
    onChoose: (key: string, on: boolean) => {
      const set = item.id === 'docker_volumes' ? setVolumes : setFiles;
      set((prev) => {
        const next = new Set(prev);
        if (on) next.add(key);
        else next.delete(key);
        return next;
      });
    },
  });

  return (
    <Shell>
      {overview}

      {scan.privilege === 'none' && (
        <div className="bg-muted/45 text-muted-foreground flex items-start gap-2 rounded-xl p-3 text-xs">
          <AlertTriangle className="size-4 shrink-0 text-(--amber)" />
          <span>
            Most of these need root. Log in as root or set up passwordless sudo,
            or run the shown command yourself.
          </span>
        </div>
      )}

      {scan.items.length === 0 ? (
        <Centered>
          <span className="flex size-12 items-center justify-center rounded-full bg-(--green)/12 text-(--green)">
            <Check className="size-6" />
          </span>
          <span className="text-foreground">Nothing to clean</span>
          <span className="text-xs">This server is already tidy.</span>
        </Centered>
      ) : (
        <div className="-mx-1 flex max-h-[min(22rem,46vh)] [scrollbar-width:thin] flex-col gap-4 overflow-y-auto px-1 pb-1">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.title} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                    {g.title}
                  </h3>
                  <span className="text-muted-foreground/80 text-[11px]">
                    {g.hint}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {g.items.map((item) => (
                    <ItemRow key={item.id} {...rowProps(item)} />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      <Footer>
        {back}
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs tabular-nums">
            {selected.length} selected
          </span>
          <Button
            size="sm"
            disabled={selected.length === 0}
            onClick={() => {
              setRunError(null);
              setStage('review');
            }}
          >
            Review · about {formatKb(estimate)}
          </Button>
        </div>
      </Footer>
    </Shell>
  );
}

/** Most cleanups need root. Docker ones only need the daemon, which the scan
    only lists when it could reach it; PM2 covers the user's own logs. */
function usable(scan: CleanupScanType, item: CleanupItemType): boolean {
  return scan.privilege !== 'none' || !!META[item.id].rootless;
}

/** Volume sizes come as one total, so a partial pick is estimated pro rata. */
function frees(
  item: CleanupItemType,
  volumes: Set<string>,
  files: Set<string>,
): number {
  if (item.id === 'docker_volumes') {
    return item.names.length
      ? (item.freesKb * volumes.size) / item.names.length
      : 0;
  }
  if (item.id === 'truncate_logs') {
    return item.files
      .filter((f) => files.has(f.path))
      .reduce((a, f) => a + f.sizeKb, 0);
  }
  return item.freesKb;
}

function commandFor(
  item: CleanupItemType,
  volumes: Set<string>,
  files: Set<string>,
): string {
  if (item.id === 'docker_volumes')
    return `docker volume rm ${[...volumes].join(' ')}`;
  if (item.id === 'truncate_logs')
    return `truncate -s 0 ${[...files].join(' ')}`;
  return item.command;
}

function ItemRow({
  item,
  disabled,
  checked,
  onToggle,
  chosen,
  onChoose,
}: {
  item: CleanupItemType;
  disabled: boolean;
  checked: boolean;
  onToggle: (on: boolean) => void;
  chosen: Set<string>;
  onChoose: (key: string, on: boolean) => void;
}) {
  const meta = META[item.id];
  const inputId = `cleanup-${item.id}`;
  const subItems =
    item.id === 'docker_volumes'
      ? item.names.map((n) => ({ key: n, label: n, size: null }))
      : item.id === 'truncate_logs'
        ? item.files.map((f) => ({
            key: f.path,
            label: f.path,
            size: f.sizeKb,
          }))
        : [];

  const tone =
    checked && meta.risk === 'danger'
      ? 'border-destructive/50 bg-destructive/6'
      : checked
        ? 'border-primary/45 bg-primary/5'
        : 'border-border hover:bg-accent/40';

  return (
    <li
      className={cn(
        'rounded-xl border px-3 py-2.5 transition-colors',
        tone,
        disabled && 'opacity-55',
      )}
    >
      <div className="flex items-center gap-3">
        <Checkbox
          id={inputId}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onToggle(v === true)}
        />
        <IconTile
          icon={meta.icon}
          tone={
            meta.risk === 'danger' ? 'danger' : checked ? 'primary' : 'muted'
          }
        />
        <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {meta.label}
            {meta.risk !== 'safe' && (
              <Badge
                variant={meta.risk === 'danger' ? 'destructive' : 'outline'}
              >
                {RISK_BADGE[meta.risk]}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {meta.description}
          </p>
          <code className="bg-muted/70 text-muted-foreground mt-1.5 inline-block max-w-full truncate rounded px-1.5 py-0.5 align-top font-mono text-[11px]">
            {item.command}
          </code>
        </label>
        <div className="shrink-0 self-start text-right tabular-nums">
          <div className="text-sm font-semibold">{formatKb(item.freesKb)}</div>
          {item.count !== null && (
            <div className="text-muted-foreground text-[11px]">
              {item.count} item{item.count === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </div>

      {subItems.length > 0 && (
        <ul className="border-border mt-2.5 ml-[4.25rem] flex flex-col gap-1 border-l pl-3">
          {subItems.map((s) => {
            const subId = `${inputId}-${s.key}`;
            return (
              <li key={s.key} className="flex items-center gap-2 text-xs">
                <Checkbox
                  id={subId}
                  checked={chosen.has(s.key)}
                  disabled={disabled}
                  onCheckedChange={(v) => onChoose(s.key, v === true)}
                />
                <label
                  htmlFor={subId}
                  className="min-w-0 flex-1 cursor-pointer truncate font-mono"
                >
                  {s.label}
                </label>
                {s.size !== null && (
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {formatKb(s.size)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function IconTile({
  icon: Icon,
  tone,
}: {
  icon: LucideIcon;
  tone: 'primary' | 'muted' | 'danger';
}) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
        tone === 'primary' && 'bg-primary/12 text-primary',
        tone === 'muted' && 'bg-muted text-muted-foreground',
        tone === 'danger' && 'bg-destructive/10 text-destructive',
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="flex min-h-64 flex-col gap-3">{children}</div>;
}

function Centered({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2.5 px-6 py-10 text-center text-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="border-border mt-auto flex items-center justify-between gap-2 border-t pt-3">
      {children}
    </div>
  );
}

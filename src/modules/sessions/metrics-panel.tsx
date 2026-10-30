import { useEffect, useRef, useState, type ReactNode } from 'react';
import { metricsService } from '../../services/metrics.service';
import type { MetricsType } from '@/types/metrics';
import { TerctlLoader } from '../../components/chrome/TerctlLogo';
import { uuid } from '@/utils/uuid';
import { HardDrive, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import DiskUsageDialog from '../disk/disk-usage-dialog';

const HIST = 34;

/** Disk use at which the explore button becomes a "free up space" nudge:
    late enough not to nag, early enough to act before the meter goes red. */
const LOW_SPACE_PCT = 80;
const BLOCKS = 20;

const BLOCK_IDS = Array.from({ length: BLOCKS }, () => uuid());
const HIST_IDS = Array.from({ length: HIST }, () => uuid());

interface Sample {
  cpu: number;
  net: number;
}

function fmtRate(bps: number): string {
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KiB/s`;
  return `${(bps / 1024 / 1024).toFixed(1)} MiB/s`;
}

function fmtGib(kb: number): string {
  const gib = kb / 1024 / 1024;
  return gib >= 10 ? `${gib.toFixed(0)} GiB` : `${gib.toFixed(1)} GiB`;
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return d > 0 ? `up ${d}d ${hh}:${mm}` : `up ${hh}:${mm}`;
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

function fillColor(position: number): string {
  if (position < 0.6) return 'var(--brand)';
  if (position < 0.85) return 'var(--amber)';
  return 'var(--red)';
}

const EMPTY_FILL = 'color-mix(in srgb, var(--foreground) 12%, transparent)';

function Section({
  index,
  name,
  children,
  onClick,
}: {
  index: number;
  name: string;
  children: ReactNode;
  /** Makes the whole box a click target, with a hover hint that it is one. */
  onClick?: () => void;
}) {
  return (
    <fieldset
      onClick={onClick}
      className={cn(
        'border-border rounded-md border px-2 pt-0 pb-2',
        onClick &&
          'hover:border-primary/50 hover:bg-primary/[0.03] cursor-pointer transition-colors',
      )}
    >
      <legend className="text-3xs px-1 font-mono tracking-wide">
        <span className="text-primary">{index}</span>
        <span className="text-muted-foreground">{name}</span>
      </legend>
      {children}
    </fieldset>
  );
}

function Meter({ pct }: { pct: number }) {
  const filled = Math.round((clampPct(pct) / 100) * BLOCKS);
  return (
    <div className="flex h-2.5 flex-1 items-stretch gap-px" aria-hidden="true">
      {BLOCK_IDS.map((id, i) => (
        <span
          key={id}
          className="flex-1 rounded-[1px]"
          style={{
            background: i < filled ? fillColor(i / BLOCKS) : EMPTY_FILL,
          }}
        />
      ))}
    </div>
  );
}

function History({
  data,
  max,
  height = 28,
}: {
  data: number[];
  max: number;
  height?: number;
}) {
  const slots = HIST_IDS.map((id, i) => ({
    id,
    value: data[i - (HIST - data.length)] ?? null,
  }));
  const ceiling = Math.max(max, 1);
  return (
    <div
      className="flex items-end gap-px"
      style={{ height }}
      aria-hidden="true"
    >
      {slots.map(({ id, value }) => {
        const ratio =
          value === null ? 0 : clampPct((value / ceiling) * 100) / 100;
        return (
          <span
            key={id}
            className="flex-1 rounded-[1px]"
            style={{
              height: value === null ? 0 : `${Math.max(ratio * 100, 4)}%`,
              background: value === null ? 'transparent' : fillColor(ratio),
            }}
          />
        );
      })}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="text-2xs flex items-baseline justify-between gap-2 font-mono">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          muted ? 'text-muted-foreground' : 'text-foreground font-semibold'
        }
      >
        {value}
      </span>
    </div>
  );
}

function MeterRow({ pct }: { pct: number }) {
  return (
    <div className="mt-0.5 flex items-center gap-2">
      <Meter pct={pct} />
      <span className="text-2xs w-8 shrink-0 text-right font-mono font-semibold tabular-nums">
        {Math.round(clampPct(pct))}%
      </span>
    </div>
  );
}

export default function MetricsPanel({
  hostId,
  hostLabel,
  connected,
}: {
  hostId: string;
  hostLabel: string;
  connected: boolean;
}) {
  const [m, setM] = useState<MetricsType | null>(null);
  const [diskOpen, setDiskOpen] = useState(false);
  const [err, setErr] = useState(false);
  const histRef = useRef<Sample[]>([]);
  const [hist, setHist] = useState<Sample[]>([]);

  useEffect(() => {
    if (!connected) return;
    let alive = true;
    const poll = async () => {
      try {
        const data = await metricsService.get(hostId);
        if (!alive) return;
        setM(data);
        setErr(false);
        histRef.current = [
          ...histRef.current,
          { cpu: data.cpu, net: data.netRx + data.netTx },
        ].slice(-HIST);
        setHist(histRef.current);
      } catch {
        if (alive) setErr(true);
      }
    };
    void poll();
    const iv = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(iv);
      void metricsService.disconnect(hostId);
    };
  }, [hostId, connected]);

  if (!connected) return null;

  if (!m) {
    return (
      <div className="text-muted-foreground flex min-h-36 shrink-0 flex-col items-center justify-center gap-2 font-mono text-xs">
        {err ? (
          <span className="text-destructive px-4 text-center">
            Couldn’t read metrics from this host.
          </span>
        ) : (
          <>
            <TerctlLoader size={54} glow={false} />
            <span>reading metrics…</span>
          </>
        )}
      </div>
    );
  }

  const memPct = m.memTotalKb ? (m.memUsedKb / m.memTotalKb) * 100 : 0;
  const diskPct = m.diskTotalKb ? (m.diskUsedKb / m.diskTotalKb) * 100 : 0;
  const load = m.load.trim().split(/\s+/);
  const netPeak = Math.max(...hist.map((s) => s.net), 1);

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <Section index={1} name="cpu">
        <Row
          label={`${m.cores} ${m.cores === 1 ? 'core' : 'cores'}`}
          value={fmtUptime(m.uptimeSec)}
          muted
        />
        <MeterRow pct={m.cpu} />
        <div className="mt-1">
          <History data={hist.map((s) => s.cpu)} max={100} />
        </div>
        <div className="text-muted-foreground text-2xs mt-1 font-mono">
          load avg: {load[0] ?? '—'} {load[1] ?? '—'} {load[2] ?? '—'}
        </div>
      </Section>

      <Section index={2} name="mem">
        <Row label="Used" value={fmtGib(m.memUsedKb)} />
        <MeterRow pct={memPct} />
        <div className="mt-1">
          <Row label="Total" value={fmtGib(m.memTotalKb)} muted />
        </div>
      </Section>

      <Section index={3} name="disk" onClick={() => setDiskOpen(true)}>
        <Row label="root" value={fmtGib(m.diskTotalKb)} />
        <MeterRow pct={diskPct} />
        <div className="mt-1">
          <Row label="Used" value={fmtGib(m.diskUsedKb)} muted />
        </div>
        {/* A real button rather than a text link: the map and cleanup are
            easy to miss otherwise. Past LOW_SPACE_PCT it turns into a nudge,
            so it stands out exactly when space is running out. */}
        <Button
          variant="outline"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            setDiskOpen(true);
          }}
          className={cn(
            'mt-2 w-full',
            diskPct >= LOW_SPACE_PCT &&
              'border-(--amber)/50 bg-(--amber)/10 text-(--amber) hover:bg-(--amber)/15 hover:text-(--amber)',
          )}
        >
          {diskPct >= LOW_SPACE_PCT ? <Sparkles /> : <HardDrive />}
          {diskPct >= LOW_SPACE_PCT ? 'Free up space' : 'Explore disk'}
        </Button>
      </Section>
      {/* Outside the section: React bubbles clicks from a portal through its
          tree, so closing the dialog from inside the box would reopen it. */}
      <DiskUsageDialog
        open={diskOpen}
        onClose={() => setDiskOpen(false)}
        hostId={hostId}
        hostLabel={hostLabel}
      />

      <Section index={4} name="net">
        <History data={hist.map((s) => s.net)} max={netPeak} height={28} />
        <div className="mt-1 flex flex-col gap-0.5">
          <Row label="▼ down" value={fmtRate(m.netRx)} />
          <Row label="▲ up" value={fmtRate(m.netTx)} />
        </div>
      </Section>

      {m.procs.length > 0 && (
        <Section index={5} name="proc">
          <div className="flex flex-col gap-1">
            {/* The two columns are otherwise identical — same width, same
                colour — so which is CPU and which is memory is a guess. */}
            <div className="text-muted-foreground/70 text-2xs flex items-baseline gap-2 font-mono">
              <span className="min-w-0 flex-1 truncate">process</span>
              <span className="w-10 shrink-0 text-right">cpu</span>
              <span className="w-10 shrink-0 text-right">mem</span>
            </div>
            {m.procs.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                className="text-2xs flex items-baseline gap-2 font-mono"
              >
                <span className="text-foreground min-w-0 flex-1 truncate">
                  {p.name}
                </span>
                <span
                  title={`CPU ${p.cpu.toFixed(1)}% (of one core)`}
                  className="text-muted-foreground w-10 shrink-0 text-right tabular-nums"
                >
                  {p.cpu.toFixed(1)}%
                </span>
                <span
                  title={`Memory ${p.mem.toFixed(1)}% of total RAM`}
                  className="text-muted-foreground w-10 shrink-0 text-right tabular-nums"
                >
                  {p.mem.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

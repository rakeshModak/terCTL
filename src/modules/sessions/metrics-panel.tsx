import { useEffect, useRef, useState, type ReactNode } from 'react'
import { metricsService } from '../../services/metrics.service'
import type { MetricsType } from '@/types/metrics'
import { TerctlLoader } from '../../components/chrome/TerctlLogo'

/** Samples kept for the history graphs (~1 minute at the 3s poll interval). */
const HIST = 34
/** Segments in a meter bar. */
const BLOCKS = 20

interface Sample {
  cpu: number
  net: number
}

// --- formatting ----------------------------------------------------------

function fmtRate(bps: number): string {
  if (bps < 1024) return `${bps} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KiB/s`
  return `${(bps / 1024 / 1024).toFixed(1)} MiB/s`
}

function fmtGib(kb: number): string {
  const gib = kb / 1024 / 1024
  return gib >= 10 ? `${gib.toFixed(0)} GiB` : `${gib.toFixed(1)} GiB`
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return d > 0 ? `up ${d}d ${hh}:${mm}` : `up ${hh}:${mm}`
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n))

/**
 * Severity ramp along a bar, btop-style: the fill starts at the accent and
 * escalates as it approaches full. Every stop is a token, so it follows the
 * accent and the light/dark mode instead of being hardcoded.
 */
function fillColor(position: number): string {
  if (position < 0.6) return 'var(--brand)'
  if (position < 0.85) return 'var(--amber)'
  return 'var(--red)'
}

const EMPTY_FILL = 'color-mix(in srgb, var(--foreground) 12%, transparent)'

// --- primitives ----------------------------------------------------------

/**
 * Bordered box with its label riding on the top border. A fieldset/legend does
 * this natively — the legend punches through the border without needing to know
 * the surface color behind it.
 */
function Section({ index, name, children }: { index: number; name: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-md border border-border px-2.5 pt-0.5 pb-2.5">
      <legend className="px-1 font-mono text-[10px] tracking-wide">
        <span className="text-primary">{index}</span>
        <span className="text-muted-foreground">{name}</span>
      </legend>
      {children}
    </fieldset>
  )
}

/** Segmented meter. Each filled block takes its color from its own position. */
function Meter({ pct }: { pct: number }) {
  const filled = Math.round((clampPct(pct) / 100) * BLOCKS)
  return (
    <div className="flex h-2.5 flex-1 items-stretch gap-px" aria-hidden="true">
      {Array.from({ length: BLOCKS }, (_, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1px]"
          style={{ background: i < filled ? fillColor(i / BLOCKS) : EMPTY_FILL }}
        />
      ))}
    </div>
  )
}

/** Right-aligned history graph; slots stay blank until the buffer fills. */
function History({ data, max, height = 34 }: { data: number[]; max: number; height?: number }) {
  const slots = Array.from({ length: HIST }, (_, i) => data[i - (HIST - data.length)] ?? null)
  const ceiling = Math.max(max, 1)
  return (
    <div className="flex items-end gap-px" style={{ height }} aria-hidden="true">
      {slots.map((v, i) => {
        const ratio = v === null ? 0 : clampPct((v / ceiling) * 100) / 100
        return (
          <span
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              // Floor non-empty samples so a near-zero reading still shows.
              height: v === null ? 0 : `${Math.max(ratio * 100, 4)}%`,
              background: v === null ? 'transparent' : fillColor(ratio),
            }}
          />
        )
      })}
    </div>
  )
}

/** label ......... value */
function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? 'text-muted-foreground' : 'font-semibold text-foreground'}>
        {value}
      </span>
    </div>
  )
}

/** A meter with its percentage pinned to the right. */
function MeterRow({ pct }: { pct: number }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <Meter pct={pct} />
      <span className="w-8 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums">
        {Math.round(clampPct(pct))}%
      </span>
    </div>
  )
}

// --- panel ---------------------------------------------------------------

/**
 * Live host metrics, laid out like a terminal system monitor.
 *
 * Mounted with a key of hostId+connected (see Inspector), so switching host or
 * reconnecting remounts this and resets the history buffer — rather than
 * resetting state from inside the effect.
 */
export default function MetricsPanel({ hostId, connected }: { hostId: string; connected: boolean }) {
  const [m, setM] = useState<MetricsType | null>(null)
  const [err, setErr] = useState(false)
  const histRef = useRef<Sample[]>([])
  const [hist, setHist] = useState<Sample[]>([])

  useEffect(() => {
    if (!connected) return
    let alive = true
    const poll = async () => {
      try {
        const data = await metricsService.get(hostId)
        if (!alive) return
        setM(data)
        setErr(false)
        histRef.current = [
          ...histRef.current,
          { cpu: data.cpu, net: data.netRx + data.netTx },
        ].slice(-HIST)
        setHist(histRef.current)
      } catch {
        if (alive) setErr(true)
      }
    }
    void poll()
    const iv = setInterval(poll, 3000)
    return () => {
      alive = false
      clearInterval(iv)
      void metricsService.disconnect(hostId)
    }
  }, [hostId, connected])

  if (!connected) return null

  if (!m) {
    return (
      <div className="flex min-h-45 flex-col items-center justify-center gap-3 font-mono text-xs text-muted-foreground">
        {err ? (
          <span className="px-4 text-center text-destructive">
            Couldn’t read metrics from this host.
          </span>
        ) : (
          <>
            <TerctlLoader size={54} glow={false} />
            <span>reading metrics…</span>
          </>
        )}
      </div>
    )
  }

  const memPct = m.memTotalKb ? (m.memUsedKb / m.memTotalKb) * 100 : 0
  const diskPct = m.diskTotalKb ? (m.diskUsedKb / m.diskTotalKb) * 100 : 0
  const load = m.load.trim().split(/\s+/)
  const netPeak = Math.max(...hist.map((s) => s.net), 1)

  return (
    <div className="flex flex-col gap-2.5">
      <Section index={1} name="cpu">
        <Row
          label={`${m.cores} ${m.cores === 1 ? 'core' : 'cores'}`}
          value={fmtUptime(m.uptimeSec)}
          muted
        />
        <MeterRow pct={m.cpu} />
        <div className="mt-1.5">
          <History data={hist.map((s) => s.cpu)} max={100} />
        </div>
        <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
          load avg: {load[0] ?? '—'} {load[1] ?? '—'} {load[2] ?? '—'}
        </div>
      </Section>

      <Section index={2} name="mem">
        <Row label="Used" value={fmtGib(m.memUsedKb)} />
        <MeterRow pct={memPct} />
        <div className="mt-1.5">
          <Row label="Total" value={fmtGib(m.memTotalKb)} muted />
        </div>
      </Section>

      <Section index={3} name="disk">
        <Row label="root" value={fmtGib(m.diskTotalKb)} />
        <MeterRow pct={diskPct} />
        <div className="mt-1.5">
          <Row label="Used" value={fmtGib(m.diskUsedKb)} muted />
        </div>
      </Section>

      <Section index={4} name="net">
        <History data={hist.map((s) => s.net)} max={netPeak} height={28} />
        <div className="mt-1.5 flex flex-col gap-0.5">
          <Row label="▼ down" value={fmtRate(m.netRx)} />
          <Row label="▲ up" value={fmtRate(m.netTx)} />
        </div>
      </Section>

      {m.procs.length > 0 && (
        <Section index={5} name="proc">
          <div className="flex flex-col gap-1">
            {m.procs.map((p, i) => (
              <div key={`${p.name}-${i}`} className="flex items-baseline gap-2 font-mono text-[11px]">
                <span className="min-w-0 flex-1 truncate text-foreground">{p.name}</span>
                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                  {p.cpu.toFixed(1)}%
                </span>
                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                  {p.mem.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

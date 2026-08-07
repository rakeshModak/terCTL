import { useEffect, useRef, useState } from 'react'
import { metricsService } from '../../services/metrics.service'
import type { Metrics } from '../../models'
import { TerctlLoader } from '../../components/chrome/TerctlLogo'

const HIST = 34 // sparkline bar count
const mono = { fontFamily: 'var(--font-mono)' } as const

function fmtRate(bps: number): string {
  if (bps < 1024) return `${bps} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
}
function fmtGb(kb: number): string {
  const gb = kb / 1024 / 1024
  return gb >= 10 ? `${gb.toFixed(0)}G` : `${gb.toFixed(1)}G`
}
function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`
}
function cpuColor(v: number): string {
  return v < 60 ? '#4bb890' : v < 85 ? '#cba062' : '#e0736a'
}

// Smooth filled area chart for the CPU history. Uses a Catmull-Rom → cubic
// smoothing so the line reads as a soft curve rather than jagged bars.
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 240
  const H = 56
  const PAD = 3
  const n = data.length

  if (n < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
        <line x1="0" y1={H - PAD} x2={W} y2={H - PAD} stroke="color-mix(in srgb, var(--foreground) 8%, transparent)" strokeWidth="1" />
      </svg>
    )
  }

  const x = (i: number) => (i / (n - 1)) * W
  const y = (v: number) => H - PAD - (Math.max(0, Math.min(100, v)) / 100) * (H - PAD * 2)
  const pts = data.map((v, i) => [x(i), y(v)] as const)

  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  const area = `${d} L${W},${H} L0,${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkFill)" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function MetricsPanel({ hostId, connected }: { hostId: string; connected: boolean }) {
  const [m, setM] = useState<Metrics | null>(null)
  const [err, setErr] = useState(false)
  const histRef = useRef<number[]>([])
  const [hist, setHist] = useState<number[]>([])

  useEffect(() => {
    setM(null)
    setErr(false)
    histRef.current = []
    setHist([])
    if (!connected) return
    let alive = true
    const poll = async () => {
      try {
        const data = await metricsService.get(hostId)
        if (!alive) return
        setM(data)
        setErr(false)
        histRef.current = [...histRef.current, data.cpu].slice(-HIST)
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
      <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-[12.5px] text-[var(--text-muted)]" style={mono}>
        {err ? (
          <span className="px-4 text-center text-[var(--red)]">Couldn’t read metrics from this host.</span>
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
  const cpuC = cpuColor(m.cpu)

  return (
    <div>
      <div className="mb-[9px] text-[10.5px] font-semibold uppercase tracking-[0.9px] text-[var(--text-faint)]">Live Metrics</div>

      <div className="mb-3 flex gap-[10px]">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-[14px] border border-[var(--border-2)] bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))] px-[15px] py-[13px]" style={{ boxShadow: '0 6px 18px -12px rgba(0,0,0,0.6)' }}>
          <div className="mb-2 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.4px] text-[var(--text-faint)]">
            <span>CPU</span>
            <span className="text-[var(--text-dim)]" style={mono} title={`${m.cores} logical CPU cores`}>
              {m.cores}
              <span className="ml-[3px] text-[8.5px] text-[var(--text-faint)]">{m.cores === 1 ? 'core' : 'cores'}</span>
            </span>
          </div>
          <div className="text-[30px] font-bold leading-none tracking-[-0.5px]" style={{ ...mono, color: cpuC, textShadow: `0 0 22px color-mix(in srgb, ${cpuC} 45%, transparent)` }}>
            {Math.round(m.cpu)}<span className="ml-[1px] text-base font-semibold opacity-70">%</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[30%]" style={{ background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${cpuC} 22%, transparent))` }} />
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-[14px] border border-[var(--border-2)] bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))] px-[15px] py-[13px]" style={{ boxShadow: '0 6px 18px -12px rgba(0,0,0,0.6)' }}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-[var(--text-faint)]">Load avg</div>
          <div className="flex flex-col gap-1">
            {['1m', '5m', '15m'].map((k, i) => (
              <div className="flex items-baseline gap-2" key={k}>
                <span className="w-[26px] text-[10.5px] text-[var(--text-faint)]" style={mono}>{k}</span>
                <span className="text-[15px] font-bold text-[var(--text-bright)]" style={mono}>{load[i] ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mb-[18px] overflow-hidden rounded-[14px] border border-[var(--border-2)] bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))] px-1 pt-[26px] pb-1">
        <span className="absolute left-[14px] top-2 text-[10px] tracking-[0.4px] text-[var(--text-faint)]" style={mono}>CPU · last minute</span>
        <Sparkline data={hist} color={cpuC} />
      </div>

      <div className="mb-2 flex items-baseline justify-between text-[13px] font-semibold text-[var(--text-bright)]">
        <span>Memory</span>
        <span className="text-[13px] font-normal text-[var(--text-dim)]" style={mono}>{fmtGb(m.memUsedKb)} / {fmtGb(m.memTotalKb)}</span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-[5px] bg-foreground/5" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)' }}>
        <div className="h-full rounded-[5px]" style={{ width: `${memPct}%`, background: 'linear-gradient(90deg,#5b9dff,#9585c4)', transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)', boxShadow: '0 0 10px -2px currentColor' }} />
      </div>

      <div className="mt-3 mb-2 flex items-baseline justify-between text-[13px] font-semibold text-[var(--text-bright)]">
        <span>Disk /</span>
        <span className="text-[13px] font-normal text-[var(--text-dim)]" style={mono}>{fmtGb(m.diskUsedKb)} / {fmtGb(m.diskTotalKb)}</span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-[5px] bg-foreground/5" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)' }}>
        <div className="h-full rounded-[5px]" style={{ width: `${diskPct}%`, background: 'linear-gradient(90deg,#cba062,#e0736a)', transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)', boxShadow: '0 0 10px -2px currentColor' }} />
      </div>

      <div className="mt-4 mb-[10px] flex gap-[10px]">
        <span className="flex flex-1 items-center justify-center gap-[6px] rounded-[10px] border border-[var(--border)] bg-[var(--bg-card-2)] px-[10px] py-2 text-[12.5px]" style={{ ...mono, color: '#4bb890' }}>↓ {fmtRate(m.netRx)}</span>
        <span className="flex flex-1 items-center justify-center gap-[6px] rounded-[10px] border border-[var(--border)] bg-[var(--bg-card-2)] px-[10px] py-2 text-[12.5px]" style={{ ...mono, color: '#5b9dff' }}>↑ {fmtRate(m.netTx)}</span>
      </div>

      <div className="mb-[6px] flex items-center gap-[7px] text-[11.5px] text-[var(--text-muted)]" style={mono}>
        <span className="h-[6px] w-[6px] rounded-full bg-[#4bb890]" style={{ boxShadow: '0 0 7px #4bb890' }} /> uptime {fmtUptime(m.uptimeSec)}
      </div>

      <div className="mt-[14px] mb-[9px] text-[10.5px] font-semibold uppercase tracking-[0.9px] text-[var(--text-faint)]">Top Processes</div>
      <div className="flex flex-col gap-2">
        {m.procs.map((p, i) => (
          <div className="flex items-center gap-[10px] rounded-[11px] border border-[var(--border)] bg-[linear-gradient(160deg,var(--bg-card-top),var(--bg-card))] px-[14px] py-[11px] transition-colors hover:border-[var(--border-2)]" key={`${p.name}-${i}`}>
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[var(--text-bright)]" style={mono}>{p.name}</span>
            <span className="text-[12.5px] text-[#d98f6a]" style={mono}>{p.cpu.toFixed(1)}%</span>
            <span className="w-12 text-right text-[12.5px] text-[#6a95c0]" style={mono}>{p.mem.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

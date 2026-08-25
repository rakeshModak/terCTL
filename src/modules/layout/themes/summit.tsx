import { useMemo } from 'react';

import { uuid } from '@/utils/uuid';
import { rng, useSvgIds } from './shared';
import { HeaderBand } from './header-band';

type Pt = [number, number];

function ridgeline(
  seed: number,
  width: number,
  yStart: number,
  yEnd: number,
  amplitude: number,
  roughness: number,
  passes: number,
): Pt[] {
  const rand = rng(seed);
  let pts: Pt[] = [
    [0, yStart],
    [width, yEnd],
  ];
  let amp = amplitude;
  for (let pass = 0; pass < passes; pass++) {
    const next: Pt[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [xa, ya] = pts[i];
      const [xb, yb] = pts[i + 1];
      next.push(pts[i]);
      next.push([(xa + xb) / 2, (ya + yb) / 2 + (rand() * 2 - 1) * amp]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    amp *= roughness;
  }
  return pts;
}

function silhouette(pts: Pt[], width: number, base: number): string {
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} L${width} ${base} L0 ${base} Z`;
}

function shadowFaces(pts: Pt[], base: number): string {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [xa, ya] = pts[i];
    const [xb, yb] = pts[i + 1];
    if (yb <= ya) continue;
    d += `M${xa.toFixed(1)} ${ya.toFixed(1)} L${xb.toFixed(1)} ${yb.toFixed(1)} L${xb.toFixed(1)} ${base} L${xa.toFixed(1)} ${base} Z `;
  }
  return d.trim();
}

function normalize(pts: Pt[], yTop: number, yBottom: number): Pt[] {
  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...ys);
  const span = Math.max(...ys) - lo || 1;
  return pts.map(([x, y]) => [x, yTop + ((y - lo) / span) * (yBottom - yTop)]);
}

function snowMask(
  seed: number,
  width: number,
  yTop: number,
  yBottom: number,
): string {
  const at = yTop + (yBottom - yTop) * 0.3;
  const amp = (yBottom - yTop) * 0.1;
  const line = normalize(
    ridgeline(seed, width, at, at, amp, 0.55, 5),
    at - amp,
    at + amp,
  );
  return `M0 0 L${width} 0 L${line
    .slice()
    .reverse()
    .map(([x, yy]) => `${x.toFixed(1)} ${yy.toFixed(1)}`)
    .join(' L')} Z`;
}

interface RangeSpec {
  pts: Pt[];
  snow: string | null;
}

function buildRanges(
  width: number,
  specs: { seed: number; yTop: number; yBottom: number; snow: boolean }[],
): RangeSpec[] {
  return specs.map((sp) => ({
    pts: normalize(
      ridgeline(sp.seed, width, 0, 0, 100, 0.52, 6),
      sp.yTop,
      sp.yBottom,
    ),
    snow: sp.snow ? snowMask(sp.seed + 991, width, sp.yTop, sp.yBottom) : null,
  }));
}

function peakNear(pts: Pt[], targetX: number): Pt {
  let best: Pt = pts[0];
  let bestDist = Infinity;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    if (y >= pts[i - 1][1] || y >= pts[i + 1][1]) continue;
    const dist = Math.abs(x - targetX);
    if (dist < bestDist) {
      bestDist = dist;
      best = pts[i];
    }
  }
  return best;
}

const WORKSPACE_RANGES = buildRanges(400, [
  { seed: 7, yTop: 58, yBottom: 118, snow: false },
  { seed: 21, yTop: 100, yBottom: 158, snow: true },
  { seed: 43, yTop: 142, yBottom: 192, snow: true },
]);

const PAGE_RANGES = buildRanges(1200, [
  { seed: 7, yTop: 200, yBottom: 410, snow: false },
  { seed: 21, yTop: 350, yBottom: 520, snow: true },
  { seed: 43, yTop: 500, yBottom: 660, snow: true },
]);

const WORKSPACE_SUMMIT = peakNear(WORKSPACE_RANGES[2].pts, 296);
const PAGE_SUMMIT = peakNear(PAGE_RANGES[2].pts, 872);

function Trekker({ x, y, h }: { x: number; y: number; h: number }) {
  const u = h / 10;
  return (
    <g
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${u.toFixed(3)})`}
      fill="var(--text-faintest)"
      opacity="0.95"
    >
      <path
        d="M2.1 -5.5 L3.4 0.3"
        stroke="var(--text-faintest)"
        strokeWidth="0.3"
        strokeLinecap="round"
      />
      <path d="M-0.2 -4.3 L-1.6 -2.1 L-2.0 0.1 L-0.9 0.1 L-0.5 -2.0 L0.5 -4.1 Z" />
      <path d="M0.7 -4.3 L1.4 -2.2 L1.9 0.1 L3.0 0.1 L2.3 -2.3 L1.6 -4.3 Z" />
      <rect x="-2.5" y="-7.7" width="1.6" height="3.1" rx="0.55" />
      <path d="M-1.2 -7.8 L1.2 -7.8 L1.4 -4.1 L-1.1 -4.1 Z" />
      <path
        d="M1.0 -7.1 L2.2 -5.3"
        stroke="var(--text-faintest)"
        strokeWidth="0.44"
        strokeLinecap="round"
      />
      <circle cx="0.1" cy="-8.8" r="1.06" />
    </g>
  );
}

function Birds({
  seed,
  count,
  x,
  y,
  spread,
  scale,
}: {
  seed: number;
  count: number;
  x: number;
  y: number;
  spread: number;
  scale: number;
}) {
  const flock = useMemo(() => {
    const rand = rng(seed);
    return Array.from({ length: count }, () => ({
      id: uuid(),
      bx: x + (rand() - 0.5) * spread,
      by: y + (rand() - 0.5) * spread * 0.42,
      s: scale * (0.55 + rand() * 0.75),
    }));
  }, [seed, count, x, y, spread, scale]);
  return (
    <g fill="none" stroke="var(--text-faintest)" strokeLinecap="round">
      {flock.map(({ id, bx, by, s }) => (
        <path
          key={id}
          d={`M${(bx - 3 * s).toFixed(1)} ${by.toFixed(1)} q${(1.5 * s).toFixed(1)} ${(-1.9 * s).toFixed(1)} ${(3 * s).toFixed(1)} 0 q${(1.5 * s).toFixed(1)} ${(-1.9 * s).toFixed(1)} ${(3 * s).toFixed(1)} 0`}
          strokeWidth={Math.max(0.35, 0.42 * s)}
          opacity={0.3 + s / scale / 3}
        />
      ))}
    </g>
  );
}

function Mist({
  cx,
  cy,
  rx,
  ry,
  id,
  opacity,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  id: string;
  opacity: number;
}) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--background)" stopOpacity="0.95" />
          <stop offset="60%" stopColor="var(--background)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--background)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={`url(#${id})`}
        opacity={opacity}
      />
    </>
  );
}

function Range({
  spec,
  width,
  base,
  opacity,
  snowColor,
  id,
}: {
  spec: RangeSpec;
  width: number;
  base: number;
  opacity: number;
  snowColor: string;
  id: string;
}) {
  const body = silhouette(spec.pts, width, base);
  return (
    <g opacity={opacity}>
      {spec.snow && (
        <clipPath id={id}>
          <path d={spec.snow} />
        </clipPath>
      )}
      <path d={body} fill="var(--text-faintest)" />
      <path
        d={shadowFaces(spec.pts, base)}
        fill="var(--text-faintest)"
        opacity="0.5"
      />
      {spec.snow && (
        <path
          d={body}
          fill={snowColor}
          opacity="0.85"
          clipPath={`url(#${id})`}
        />
      )}
    </g>
  );
}

function Haze({
  y,
  width,
  base,
  id,
}: {
  y: number;
  width: number;
  base: number;
  id: string;
}) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--background)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--background)" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <rect y={y} width={width} height={base - y} fill={`url(#${id})`} />
    </>
  );
}

function SummitSun({
  cx,
  cy,
  r,
  id,
}: {
  cx: number;
  cy: number;
  r: number;
  id: string;
}) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.5" />
          <stop offset="22%" stopColor="var(--brand)" stopOpacity="0.3" />
          <stop offset="55%" stopColor="var(--brand)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r * 6} fill={`url(#${id})`} />
    </>
  );
}

function Pines({
  xs,
  base,
  h,
  opacity,
}: {
  xs: number[];
  base: number;
  h: number;
  opacity: number;
}) {
  return (
    <g fill="var(--text-faintest)" opacity={opacity}>
      {xs.map((x, i) => {
        const s = h * (0.68 + ((i * 37) % 11) / 20);
        const w = s * 0.4;
        return (
          <g key={x}>
            <rect
              x={x - s * 0.035}
              y={base - s * 0.22}
              width={s * 0.07}
              height={s * 0.22}
            />
            <path
              d={`M${x} ${base - s} L${x + w * 0.6} ${base - s * 0.54} L${x - w * 0.6} ${base - s * 0.54} Z`}
            />
            <path
              d={`M${x} ${base - s * 0.79} L${x + w * 0.82} ${base - s * 0.28} L${x - w * 0.82} ${base - s * 0.28} Z`}
            />
            <path
              d={`M${x} ${base - s * 0.52} L${x + w} ${base - s * 0.03} L${x - w} ${base - s * 0.03} Z`}
            />
          </g>
        );
      })}
    </g>
  );
}

export function SummitWorkspace() {
  const svgId = useSvgIds();
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice">
      <SummitSun cx={312} cy={62} r={9} id={svgId('sun-ws')} />
      <Birds seed={5} count={7} x={104} y={58} spread={96} scale={2.6} />
      <Range
        spec={WORKSPACE_RANGES[0]}
        width={400}
        base={200}
        opacity={0.3}
        snowColor="var(--background)"
        id={svgId('snow-ws0')}
      />
      <Haze y={96} width={400} base={200} id={svgId('haze-ws')} />
      <Range
        spec={WORKSPACE_RANGES[1]}
        width={400}
        base={200}
        opacity={0.5}
        snowColor="var(--background)"
        id={svgId('snow-ws1')}
      />
      <Mist
        cx={150}
        cy={162}
        rx={190}
        ry={17}
        id={svgId('mist-ws')}
        opacity={0.75}
      />
      <Range
        spec={WORKSPACE_RANGES[2]}
        width={400}
        base={200}
        opacity={0.74}
        snowColor="var(--background)"
        id={svgId('snow-ws2')}
      />
      <Trekker x={WORKSPACE_SUMMIT[0]} y={WORKSPACE_SUMMIT[1]} h={11} />
      <Pines
        xs={[10, 25, 42, 58, 344, 360, 378, 393]}
        base={200}
        h={24}
        opacity={0.85}
      />
    </svg>
  );
}

export function SummitSidebar() {
  return (
    <svg viewBox="0 0 60 160" preserveAspectRatio="xMidYMax slice">
      <Pines xs={[4, 15, 26, 37, 48, 58]} base={148} h={30} opacity={0.3} />
      <Pines xs={[-2, 10, 21, 32, 44, 55]} base={160} h={42} opacity={0.62} />
    </svg>
  );
}

export function SummitHeader() {
  const svgId = useSvgIds();
  // The gull is two arcs across a normalised 100x100 box. Drawn as its own
  // uniformly-scaled motif so the curve keeps its sweep — stretched into the
  // bar's own viewBox it flattened into a pair of flat dashes.
  const gull = (
    <path
      d="M11 58 q19.5 -24.7 39 0 q19.5 -24.7 39 0"
      fill="none"
      stroke="var(--text-faintest)"
      strokeWidth="6"
      strokeLinecap="round"
    />
  );

  return (
    <HeaderBand
      wash={
        <>
          <defs>
            <linearGradient id={svgId('haze')} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--text-faintest)"
                stopOpacity="0"
              />
              <stop
                offset="100%"
                stopColor="var(--text-faintest)"
                stopOpacity="0.5"
              />
            </linearGradient>
            <radialGradient id={svgId('sun')} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.42" />
              <stop offset="45%" stopColor="var(--brand)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect
            y="14"
            width="1600"
            height="32"
            fill={`url(#${svgId('haze')})`}
          />
          <ellipse
            cx="1210"
            cy="20"
            rx="380"
            ry="46"
            fill={`url(#${svgId('sun')})`}
          />
        </>
      }
      motifs={[
        { at: 0.14, size: 16, y: 0.42, opacity: 0.6, draw: gull },
        { at: 0.21, size: 11, y: 0.66, opacity: 0.45, draw: gull },
        { at: 0.3, size: 13, y: 0.3, opacity: 0.5, draw: gull },
        { at: 0.48, size: 14, y: 0.6, opacity: 0.5, draw: gull },
        { at: 0.55, size: 10, y: 0.36, opacity: 0.42, draw: gull },
        { at: 0.72, size: 16, y: 0.64, opacity: 0.55, draw: gull },
        { at: 0.88, size: 12, y: 0.4, opacity: 0.45, draw: gull },
      ]}
    />
  );
}

export function SummitPage() {
  const svgId = useSvgIds();
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
      <SummitSun cx={936} cy={202} r={30} id={svgId('sun-pg')} />
      <Birds seed={5} count={9} x={318} y={190} spread={300} scale={8} />
      <Range
        spec={PAGE_RANGES[0]}
        width={1200}
        base={700}
        opacity={0.26}
        snowColor="var(--background)"
        id={svgId('snow-pg0')}
      />
      <Haze y={340} width={1200} base={700} id={svgId('haze-pg')} />
      <Range
        spec={PAGE_RANGES[1]}
        width={1200}
        base={700}
        opacity={0.44}
        snowColor="var(--background)"
        id={svgId('snow-pg1')}
      />
      <Mist
        cx={440}
        cy={552}
        rx={560}
        ry={54}
        id={svgId('mist-pg')}
        opacity={0.75}
      />
      <Range
        spec={PAGE_RANGES[2]}
        width={1200}
        base={700}
        opacity={0.66}
        snowColor="var(--background)"
        id={svgId('snow-pg2')}
      />
      <Trekker x={PAGE_SUMMIT[0]} y={PAGE_SUMMIT[1]} h={34} />
      <Pines
        xs={[22, 58, 98, 136, 174, 1030, 1070, 1110, 1150, 1186]}
        base={700}
        h={74}
        opacity={0.85}
      />
    </svg>
  );
}

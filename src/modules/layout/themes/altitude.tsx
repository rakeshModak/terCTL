import { useMemo } from 'react';

import { uuid } from '@/utils/uuid';
import { rng, useSvgIds } from './shared';
import { HeaderBand } from './header-band';

function cumulus(seed: number, w: number, h: number) {
  const rand = rng(seed);
  const lobes: { id: string; cx: number; cy: number; r: number }[] = [];
  const n = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const bell = Math.sin(t * Math.PI) ** 0.7;
    const r = h * (0.3 + bell * 0.72) * (0.78 + rand() * 0.44);
    lobes.push({
      id: uuid(),
      cx: w * (0.06 + t * 0.88) + (rand() - 0.5) * w * 0.07,
      cy: h - r * (0.52 + rand() * 0.3),
      r,
    });
  }
  lobes.push({
    id: uuid(),
    cx: w * 0.5,
    cy: h - h * 0.16,
    r: Math.max(w * 0.3, h * 0.42),
  });
  return lobes;
}

function Cloud({
  x,
  y,
  w,
  h,
  seed,
  opacity,
  rim,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  opacity: number;
  rim: number;
}) {
  const lobes = useMemo(() => cumulus(seed, w, h), [seed, w, h]);
  const puffs = (fill: string, dx: number, dy: number) => (
    <g
      fill={fill}
      transform={`translate(${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)})`}
    >
      {lobes.map((l) => (
        <circle key={l.id} cx={l.cx} cy={l.cy} r={l.r} />
      ))}
    </g>
  );
  return (
    <g opacity={opacity}>
      {puffs('var(--brand)', rim, -rim * 0.72)}
      {puffs('var(--text-faintest)', 0, 0)}
    </g>
  );
}

const PLANE =
  'M100 4 C108 4 112 20 113 42 L115 152 C115 170 108 182 100 182 ' +
  'C92 182 85 170 85 152 L87 42 C88 20 92 4 100 4 Z ' +
  'M113 70 L197 133 L198 144 L112 116 Z ' +
  'M87 70 L3 133 L2 144 L88 116 Z ' +
  'M112 150 L153 177 L154 183 L111 167 Z ' +
  'M88 150 L47 177 L46 183 L89 167 Z';

function Plane({
  x,
  y,
  size,
  rotate,
  svgId,
}: {
  x: number;
  y: number;
  size: number;
  rotate: number;
  svgId: (n: string) => string;
}) {
  const s = size / 200;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      {[-1, 1].map((side) => (
        <path
          key={side}
          d={`M${side * size * 0.19} ${size * 0.34} L${side * size * 0.26} ${size * 2.6} L${side * size * 0.12} ${size * 2.6} Z`}
          fill={`url(#${svgId('trail')})`}
        />
      ))}
      <g transform={`translate(${-size / 2} ${-size / 2}) scale(${s})`}>
        <path d={PLANE} fill="var(--text-faintest)" />
        {[-1, 1].map((side) => (
          <ellipse
            key={side}
            cx={100 + side * 40}
            cy={100}
            rx={9}
            ry={17}
            fill="var(--text-faintest)"
          />
        ))}
        <path
          d="M113 70 L197 133 L196 137 L112 78 Z M87 70 L3 133 L4 137 L88 78 Z"
          fill="var(--brand)"
          opacity="0.75"
        />
      </g>
    </g>
  );
}

function SkyScene({
  w,
  h,
  svgId,
  detail = true,
}: {
  w: number;
  h: number;
  svgId: (n: string) => string;
  detail?: boolean;
}) {
  const rim = Math.max(1.2, h * 0.012);
  return (
    <>
      <defs>
        <linearGradient id={svgId('sky')} x1="0" y1="0" x2="0.35" y2="1">
          <stop
            offset="0%"
            stopColor="var(--text-faintest)"
            stopOpacity="0.26"
          />
          <stop offset="55%" stopColor="var(--brand)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.26" />
        </linearGradient>
        <radialGradient id={svgId('sun')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.55" />
          <stop offset="35%" stopColor="var(--brand)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={svgId('trail')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width={w} height={h} fill={`url(#${svgId('sky')})`} />
      <ellipse
        cx={w * 0.78}
        cy={h * 0.3}
        rx={w * 0.4}
        ry={h * 0.5}
        fill={`url(#${svgId('sun')})`}
      />

      <Cloud
        x={w * -0.04}
        y={h * 0.44}
        w={w * 0.34}
        h={h * 0.1}
        seed={5}
        opacity={0.16}
        rim={rim * 0.6}
      />
      <Cloud
        x={w * 0.44}
        y={h * 0.4}
        w={w * 0.38}
        h={h * 0.11}
        seed={9}
        opacity={0.16}
        rim={rim * 0.6}
      />

      {detail && (
        <Plane
          x={w * 0.79}
          y={h * 0.19}
          size={h * 0.17}
          rotate={-24}
          svgId={svgId}
        />
      )}

      <Cloud
        x={w * 0.06}
        y={h * 0.74}
        w={w * 0.42}
        h={h * 0.2}
        seed={17}
        opacity={0.3}
        rim={rim}
      />
      <Cloud
        x={w * 0.58}
        y={h * 0.72}
        w={w * 0.46}
        h={h * 0.22}
        seed={23}
        opacity={0.3}
        rim={rim}
      />

      <Cloud
        x={w * -0.12}
        y={h * 1.02}
        w={w * 0.66}
        h={h * 0.3}
        seed={31}
        opacity={0.5}
        rim={rim * 1.3}
      />
      <Cloud
        x={w * 0.48}
        y={h * 1.06}
        w={w * 0.72}
        h={h * 0.34}
        seed={37}
        opacity={0.5}
        rim={rim * 1.3}
      />
    </>
  );
}

export function AltitudeWorkspace() {
  const svgId = useSvgIds();
  return (
    <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice">
      <SkyScene w={1000} h={560} svgId={svgId} />
    </svg>
  );
}

export function AltitudeSidebar() {
  const svgId = useSvgIds();
  return (
    <svg viewBox="0 0 60 200" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id={svgId('sky')} x1="0" y1="0" x2="0.35" y2="1">
          <stop
            offset="0%"
            stopColor="var(--text-faintest)"
            stopOpacity="0.26"
          />
          <stop offset="55%" stopColor="var(--brand)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.26" />
        </linearGradient>
        <radialGradient id={svgId('sun')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="60" height="200" fill={`url(#${svgId('sky')})`} />
      <ellipse cx={44} cy={92} rx={46} ry={62} fill={`url(#${svgId('sun')})`} />
      <Cloud x={-14} y={150} w={62} h={22} seed={17} opacity={0.3} rim={2} />
      <Cloud x={-6} y={196} w={78} h={30} seed={31} opacity={0.5} rim={2.6} />
    </svg>
  );
}

export function AltitudeHeader() {
  const svgId = useSvgIds();
  // Cloud and Plane are authored around an arbitrary origin, so each is placed
  // into its own normalised 100x100 motif box and scaled uniformly from there.
  const cloud = (seed: number) => (
    <Cloud x={3} y={30} w={94} h={34} seed={seed} opacity={1} rim={2.4} />
  );
  // `trail` is declared locally rather than reused from the wash's <defs>: the
  // motif is a separate <svg> element, and keeping the reference inside the same
  // element is what makes the gradient survive independently of the wash.
  const plane = (
    <>
      <defs>
        <linearGradient id={svgId('mtrail')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <Plane
        x={50}
        y={44}
        size={62}
        rotate={-24}
        svgId={() => svgId('mtrail')}
      />
    </>
  );

  return (
    <HeaderBand
      wash={
        <>
          <defs>
            <linearGradient id={svgId('sky')} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--text-faintest)"
                stopOpacity="0.24"
              />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.16" />
            </linearGradient>
            <radialGradient id={svgId('sun')} cx="76%" cy="70%" r="46%">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.36" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1600" height="46" fill={`url(#${svgId('sky')})`} />
          <rect width="1600" height="46" fill={`url(#${svgId('sun')})`} />
        </>
      }
      motifs={[
        { at: 0.12, size: 40, y: 0.72, opacity: 0.5, draw: cloud(17) },
        { at: 0.35, size: 33, y: 0.78, opacity: 0.42, draw: cloud(23) },
        { at: 0.58, size: 28, y: 0.74, opacity: 0.38, draw: cloud(31) },
        { at: 0.74, size: 26, y: 0.42, opacity: 0.7, draw: plane },
        { at: 0.89, size: 37, y: 0.76, opacity: 0.46, draw: cloud(37) },
      ]}
    />
  );
}

export function AltitudePage() {
  const svgId = useSvgIds();
  return (
    <svg viewBox="0 0 1400 780" preserveAspectRatio="xMidYMid slice">
      <SkyScene w={1400} h={780} svgId={svgId} />
    </svg>
  );
}

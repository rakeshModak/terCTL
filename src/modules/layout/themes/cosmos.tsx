import { useMemo } from 'react';

import { uuid } from '@/utils/uuid';
import { useSvgIds } from './shared';
import { HeaderBand } from './header-band';

function stars(count: number, w: number, h: number, seed: number) {
  const out: { id: string; cx: number; cy: number; r: number; o: number }[] =
    [];
  for (let i = 1; i <= count; i++) {
    const a = Math.sin(i * 12.9898 + seed) * 43758.5453;
    const b = Math.sin(i * 78.233 + seed) * 24634.6345;
    const c = Math.sin(i * 45.164 + seed) * 15731.743;
    out.push({
      id: uuid(),
      cx: (a - Math.floor(a)) * w,
      cy: (b - Math.floor(b)) * h,
      r: 0.6 + (c - Math.floor(c)) * 1.5,
      o: 0.25 + (c - Math.floor(c)) * 0.55,
    });
  }
  return out;
}

export function CosmosWorkspace() {
  const svgId = useSvgIds();
  const field = useMemo(() => stars(46, 400, 200, 3), []);
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={svgId('nebula')} cx="72%" cy="30%" r="55%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${svgId('nebula')})`} />
      {field.map((s) => (
        <circle
          key={s.id}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill="var(--text-bright)"
          opacity={s.o}
        />
      ))}
      <g
        transform="translate(288 66) rotate(-18)"
        fill="none"
        stroke="var(--brand-2)"
      >
        <ellipse rx="74" ry="26" strokeWidth="1.2" opacity="0.55" />
        <ellipse rx="50" ry="17" strokeWidth="1" opacity="0.4" />
      </g>
      <circle cx="288" cy="66" r="11" fill="var(--brand)" opacity="0.6" />
      <circle cx="360" cy="56" r="3.5" fill="var(--brand-2)" opacity="0.8" />
      <g transform="translate(76 138)">
        <circle r="22" fill="var(--brand-2)" opacity="0.5" />
        <circle cx="9" cy="-6" r="20" fill="var(--background)" />
      </g>
    </svg>
  );
}

export function CosmosSidebar() {
  const field = useMemo(() => stars(16, 60, 160, 9), []);
  return (
    <svg viewBox="0 0 60 160" preserveAspectRatio="xMidYMax slice">
      {field.map((s) => (
        <circle
          key={s.id}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill="var(--text-bright)"
          opacity={s.o}
        />
      ))}
      <g
        transform="translate(30 128) rotate(-14)"
        fill="none"
        stroke="var(--brand-2)"
      >
        <ellipse rx="24" ry="9" strokeWidth="1.1" opacity="0.6" />
      </g>
      <circle cx="30" cy="128" r="6" fill="var(--brand)" opacity="0.7" />
    </svg>
  );
}

export function CosmosHeader() {
  const svgId = useSvgIds();
  // Four-point star on a normalised 100x100 box, centred at 50,50.
  const sparkle = (
    <path
      d="M50 6 q6 34 44 44 q-38 10 -44 44 q-6 -34 -44 -44 q38 -10 44 -44 Z"
      fill="var(--brand-2)"
    />
  );
  const star = <circle cx="50" cy="50" r="16" fill="var(--brand)" />;
  const moon = (
    <g>
      <circle cx="50" cy="50" r="42" fill="var(--brand-2)" />
      <circle cx="72" cy="36" r="37" fill="var(--background)" />
    </g>
  );

  return (
    <HeaderBand
      wash={
        <>
          <defs>
            <radialGradient id={svgId('hdr')} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse
            cx="1180"
            cy="20"
            rx="440"
            ry="46"
            fill={`url(#${svgId('hdr')})`}
          />
        </>
      }
      motifs={[
        { at: 0.16, size: 13, y: 0.34, opacity: 0.45, draw: sparkle },
        { at: 0.27, size: 5, y: 0.66, opacity: 0.4, draw: star },
        { at: 0.42, size: 10, y: 0.28, opacity: 0.38, draw: sparkle },
        { at: 0.55, size: 5, y: 0.72, opacity: 0.36, draw: star },
        { at: 0.66, size: 15, y: 0.62, opacity: 0.48, draw: sparkle },
        { at: 0.78, size: 4.5, y: 0.26, opacity: 0.34, draw: star },
        { at: 0.9, size: 20, y: 0.5, opacity: 0.42, draw: moon },
      ]}
    />
  );
}

export function CosmosPage() {
  const svgId = useSvgIds();
  const field = useMemo(() => stars(120, 1200, 700, 11), []);
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={svgId('page')} cx="82%" cy="16%" r="58%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="700" fill={`url(#${svgId('page')})`} />
      {field.map((s) => (
        <circle
          key={s.id}
          cx={s.cx}
          cy={s.cy}
          r={s.r * 1.3}
          fill="var(--text-bright)"
          opacity={s.o}
        />
      ))}
      <g
        transform="translate(1010 128) rotate(-18)"
        fill="none"
        stroke="var(--brand-2)"
      >
        <ellipse rx="150" ry="52" strokeWidth="1.6" opacity="0.5" />
        <ellipse rx="100" ry="34" strokeWidth="1.3" opacity="0.36" />
      </g>
      <circle cx="1010" cy="128" r="22" fill="var(--brand)" opacity="0.55" />
      <g transform="translate(140 566)">
        <circle r="46" fill="var(--brand-2)" opacity="0.45" />
        <circle cx="19" cy="-13" r="42" fill="var(--background)" />
      </g>
    </svg>
  );
}

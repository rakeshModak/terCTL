import { useSvgIds } from './shared';
import { HeaderBand } from './header-band';

export function DoodleWorkspace() {
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">
      <g
        fill="none"
        stroke="var(--brand-2)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M72 92 a20 20 0 0 1 34 -14 a16 16 0 0 1 26 10 a15 15 0 0 1 -4 29 h-46 a17 17 0 0 1 -10 -25 Z" />
        <path d="M92 100 q6 7 13 0" />
        <circle cx="88" cy="90" r="1.8" fill="var(--brand-2)" />
        <circle cx="108" cy="90" r="1.8" fill="var(--brand-2)" />
        <path d="M150 152 q14 -20 28 0 t28 0 t28 0" />
        <path d="M262 62 l14 -18 l14 18 l14 -18 l14 18" />
      </g>
      <g stroke="none">
        <circle cx="330" cy="132" r="19" fill="var(--brand)" opacity="0.4" />
        <rect
          x="196"
          y="52"
          width="26"
          height="26"
          rx="7"
          fill="var(--brand-2)"
          opacity="0.35"
          transform="rotate(14 209 65)"
        />
        {[
          [46, 156],
          [368, 74],
          [242, 118],
        ].map(([x, y]) => (
          <path
            key={`${x}-${y}`}
            d={`M${x} ${y - 10} q2 8 10 10 q-8 2 -10 10 q-2 -8 -10 -10 q8 -2 10 -10 Z`}
            fill="var(--brand)"
            opacity="0.5"
          />
        ))}
      </g>
    </svg>
  );
}

export function DoodleSidebar() {
  return (
    <svg viewBox="0 0 60 160" preserveAspectRatio="xMidYMax slice">
      <g
        fill="none"
        stroke="var(--brand-2)"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M18 150 q12 -16 24 0" />
        <path d="M18 130 q12 -16 24 0" />
        <path d="M30 108 l0 -14" />
      </g>
      <circle cx="30" cy="74" r="12" fill="var(--brand)" opacity="0.45" />
      <path
        d="M30 44 q2 8 10 10 q-8 2 -10 10 q-2 -8 -10 -10 q8 -2 10 -10 Z"
        fill="var(--brand-2)"
        opacity="0.55"
      />
    </svg>
  );
}

export function DoodleHeader() {
  const svgId = useSvgIds();
  // Each motif fills a normalised 100x100 box, centred at 50,50.
  const spark = (
    <path
      d="M50 6 q6 34 44 44 q-38 10 -44 44 q-6 -34 -44 -44 q38 -10 44 -44 Z"
      fill="var(--brand-2)"
    />
  );
  const blob = <circle cx="50" cy="50" r="42" fill="var(--brand)" />;
  const chip = (
    <rect
      x="14"
      y="14"
      width="72"
      height="72"
      rx="22"
      fill="var(--brand-2)"
      transform="rotate(16 50 50)"
    />
  );

  return (
    <HeaderBand
      wash={
        <>
          <defs>
            <radialGradient id={svgId('a')} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand-2)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--brand-2)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={svgId('b')} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse
            cx="280"
            cy="24"
            rx="420"
            ry="42"
            fill={`url(#${svgId('a')})`}
          />
          <ellipse
            cx="1000"
            cy="30"
            rx="460"
            ry="44"
            fill={`url(#${svgId('b')})`}
          />
          <ellipse
            cx="1540"
            cy="18"
            rx="360"
            ry="38"
            fill={`url(#${svgId('a')})`}
          />
        </>
      }
      motifs={[
        { at: 0.14, size: 15, y: 0.52, opacity: 0.5, draw: spark },
        { at: 0.28, size: 9, y: 0.66, opacity: 0.4, draw: blob },
        { at: 0.43, size: 11, y: 0.3, opacity: 0.42, draw: chip },
        { at: 0.57, size: 12, y: 0.64, opacity: 0.45, draw: spark },
        { at: 0.7, size: 7, y: 0.32, opacity: 0.38, draw: blob },
        { at: 0.83, size: 14, y: 0.56, opacity: 0.48, draw: spark },
        { at: 0.93, size: 9, y: 0.34, opacity: 0.36, draw: chip },
      ]}
    />
  );
}

export function DoodlePage() {
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
      <g
        fill="none"
        stroke="var(--brand-2)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M96 168 a30 30 0 0 1 51 -21 a24 24 0 0 1 39 15 a22 22 0 0 1 -6 43 h-69 a25 25 0 0 1 -15 -37 Z" />
        <path d="M126 180 q9 11 20 0" />
        <path d="M1010 596 q21 -30 42 0 t42 0" />
        <path d="M1054 128 l21 -27 l21 27 l21 -27 l21 27" />
        <path d="M104 578 q21 -30 42 0 t42 0" />
      </g>
      <g stroke="none">
        <circle cx="120" cy="172" r="3" fill="var(--brand-2)" />
        <circle cx="150" cy="172" r="3" fill="var(--brand-2)" />
        <circle cx="1108" cy="452" r="34" fill="var(--brand)" opacity="0.32" />
        <rect
          x="58"
          y="404"
          width="46"
          height="46"
          rx="12"
          fill="var(--brand-2)"
          opacity="0.3"
          transform="rotate(14 81 427)"
        />
        {[
          [1140, 236],
          [64, 286],
          [1064, 322],
        ].map(([x, y]) => (
          <path
            key={`${x}-${y}`}
            d={`M${x} ${y - 18} q4 14 18 18 q-14 4 -18 18 q-4 -14 -18 -18 q14 -4 18 -18 Z`}
            fill="var(--brand)"
            opacity="0.42"
          />
        ))}
      </g>
    </svg>
  );
}

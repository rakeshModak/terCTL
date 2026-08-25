import { useSvgIds } from './shared';
import { HeaderBand } from './header-band';

export function BloomWorkspace() {
  const stem = (x: number, scale: number, flip: boolean) => (
    <g
      key={`${x}-${scale}`}
      transform={`translate(${x} 200) scale(${flip ? -scale : scale} ${scale})`}
    >
      <path
        d="M0 0 C 0 -30 -8 -50 -4 -78"
        fill="none"
        stroke="var(--brand-2)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M-2 -30 C -18 -36 -24 -48 -22 -58 C -10 -54 -3 -42 -2 -30 Z"
        fill="var(--brand-2)"
        opacity="0.35"
      />
      <path
        d="M-3 -50 C 10 -56 18 -68 17 -78 C 5 -73 -1 -61 -3 -50 Z"
        fill="var(--brand-2)"
        opacity="0.28"
      />
      <g transform="translate(-4 -84)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse
            key={deg}
            rx="6"
            ry="12"
            cy="-11"
            fill="var(--brand)"
            opacity="0.45"
            transform={`rotate(${deg})`}
          />
        ))}
        <circle r="4.5" fill="var(--brand-2)" />
      </g>
    </g>
  );

  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice">
      {stem(64, 1, false)}
      {stem(150, 0.68, true)}
      {stem(330, 0.86, false)}
      {[
        [110, 70],
        [205, 48],
        [268, 96],
        [300, 40],
        [42, 108],
        [352, 118],
      ].map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="2.5"
          fill="var(--brand)"
          opacity="0.3"
        />
      ))}
    </svg>
  );
}

export function BloomSidebar() {
  return (
    <svg viewBox="0 0 60 160" preserveAspectRatio="xMidYMax slice">
      <path
        d="M30 160 C 30 120 20 100 26 62"
        fill="none"
        stroke="var(--brand-2)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {[
        [28, 118, 1],
        [24, 92, -1],
        [27, 70, 1],
      ].map(([x, y, dir]) => (
        <path
          key={y}
          d={`M${x} ${y} c ${12 * dir} -4 ${16 * dir} -14 ${14 * dir} -22 c ${-9 * dir} 3 ${-13 * dir} 13 ${-14 * dir} 22 Z`}
          fill="var(--brand-2)"
          opacity="0.4"
        />
      ))}
      <g transform="translate(26 54)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse
            key={deg}
            rx="4"
            ry="8"
            cy="-7"
            fill="var(--brand)"
            opacity="0.5"
            transform={`rotate(${deg})`}
          />
        ))}
        <circle r="3" fill="var(--brand-2)" />
      </g>
    </svg>
  );
}

export function BloomHeader() {
  const svgId = useSvgIds();
  // Drawn into a normalised 100x100 box — HeaderBand scales it uniformly, so the
  // petals keep their proportions at any window width.
  const flower = (
    <g transform="translate(50 50)">
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          rx="17"
          ry="30"
          cy="-26"
          fill="var(--brand)"
          transform={`rotate(${deg})`}
        />
      ))}
      <circle r="12" fill="var(--brand-2)" />
    </g>
  );
  const bud = <circle cx="50" cy="50" r="18" fill="var(--brand-2)" />;

  return (
    <HeaderBand
      wash={
        <>
          <defs>
            <radialGradient id={svgId('a')} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={svgId('b')} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand-2)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--brand-2)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse
            cx="210"
            cy="32"
            rx="420"
            ry="40"
            fill={`url(#${svgId('a')})`}
          />
          <ellipse
            cx="900"
            cy="12"
            rx="460"
            ry="34"
            fill={`url(#${svgId('b')})`}
          />
          <ellipse
            cx="1470"
            cy="34"
            rx="400"
            ry="38"
            fill={`url(#${svgId('a')})`}
          />
        </>
      }
      motifs={[
        { at: 0.12, size: 13, y: 0.6, opacity: 0.5, draw: flower },
        { at: 0.27, size: 6, y: 0.3, opacity: 0.4, draw: bud },
        { at: 0.44, size: 10, y: 0.34, opacity: 0.42, draw: flower },
        { at: 0.58, size: 6, y: 0.68, opacity: 0.36, draw: bud },
        { at: 0.71, size: 15, y: 0.58, opacity: 0.5, draw: flower },
        { at: 0.86, size: 7, y: 0.32, opacity: 0.4, draw: bud },
      ]}
    />
  );
}

export function BloomPage() {
  const stem = (x: number, y: number, scale: number, flip: boolean) => (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}
    >
      <path
        d="M0 0 C 0 -34 -9 -56 -4 -88"
        fill="none"
        stroke="var(--brand-2)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M-2 -34 C -19 -40 -26 -53 -24 -64 C -11 -60 -3 -47 -2 -34 Z"
        fill="var(--brand-2)"
        opacity="0.35"
      />
      <path
        d="M-3 -56 C 11 -62 20 -75 19 -86 C 6 -81 -1 -68 -3 -56 Z"
        fill="var(--brand-2)"
        opacity="0.28"
      />
      <g transform="translate(-4 -95)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse
            key={deg}
            rx="7"
            ry="14"
            cy="-12"
            fill="var(--brand)"
            opacity="0.42"
            transform={`rotate(${deg})`}
          />
        ))}
        <circle r="5" fill="var(--brand-2)" />
      </g>
    </g>
  );

  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
      {stem(90, 700, 1.15, false)}
      {stem(232, 700, 0.72, true)}
      {stem(1118, 700, 1.05, true)}
      {stem(975, 700, 0.66, false)}
      {[
        [330, 180],
        [520, 96],
        [700, 150],
        [880, 84],
        [1050, 210],
        [180, 300],
        [1150, 380],
        [60, 150],
      ].map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="6"
          fill="var(--brand)"
          opacity="0.28"
        />
      ))}
    </svg>
  );
}

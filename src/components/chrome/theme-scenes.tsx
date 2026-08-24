import { useId } from 'react';
/**
 * Artwork for the illustrated themes (Bloom / Cosmos / Doodle).
 *
 * Everything here is inline SVG drawn in theme tokens — `--brand`, `--brand-2`
 * and the ink ramp — so a scene recolours with the accent and stays legible in
 * both modes without a second hand-authored copy. No raster assets, nothing
 * fetched: a Tauri webview has no network and the app ships no image pipeline.
 *
 * Components only, by design — the slot table that consumes them lives in
 * constants/theme-art.ts, so neither file mixes components with helpers.
 */

/**
 * Unique SVG ids per rendered instance.
 *
 * `url(#id)` binds to the first element with that id in the whole document, and
 * a gradient's `var()` stops resolve in the gradient's own context — so two
 * copies of a scene (the live backdrop and a settings preview) would silently
 * share the first copy's colours. Colons are stripped because useId emits them
 * and they are awkward inside a fragment reference.
 */
function useSvgIds(): (name: string) => string {
  const uid = useId().replace(/:/g, '');
  return (name: string) => `terctl-${uid}-${name}`;
}

// ---------------------------------------------------------------- Bloom ----

export function BloomWorkspace() {
  // One stem drawn three times at different scales, rather than three hand-set
  // stems — keeps the silhouette consistent as the viewport changes.
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
      {/* Drifting pollen, scattered rather than gridded so it reads organic. */}
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
  // Deliberately compact and bottom-anchored: the sidebar is a narrow strip of
  // nav icons, and a full-column composition crowded them.
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
  // The wash alone was invisible at this slot's weight. Small discrete motifs
  // are safe on top of it: unlike a continuous stroke, a shape an opaque tab
  // pill lands on is simply hidden rather than visibly severed.
  const svgId = useSvgIds();
  const flower = (x: number, y: number, r: number, o: number) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y})`} opacity={o}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse key={deg} rx={r * 0.42} ry={r} cy={-r * 0.85} fill="var(--brand)" transform={`rotate(${deg})`} />
      ))}
      <circle r={r * 0.42} fill="var(--brand-2)" />
    </g>
  );
  return (
    <svg viewBox="0 0 1600 46" preserveAspectRatio="none">
      <defs>
        <radialGradient id={svgId('a')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={svgId('b')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand-2)" stopOpacity="0.65" />
          <stop offset="100%" stopColor="var(--brand-2)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="160" cy="30" rx="340" ry="42" fill={`url(#${svgId('a')})`} />
      <ellipse cx="860" cy="14" rx="420" ry="36" fill={`url(#${svgId('b')})`} />
      <ellipse cx="1480" cy="34" rx="360" ry="40" fill={`url(#${svgId('a')})`} />
      {flower(150, 26, 7, 0.75)}
      {flower(430, 32, 5, 0.55)}
      {flower(700, 16, 6.5, 0.65)}
      {flower(980, 30, 8, 0.8)}
      {flower(1250, 18, 5.5, 0.6)}
      {flower(1500, 28, 7, 0.7)}
      {[[300, 34], [560, 14], [840, 36], [1120, 12], [1380, 34]].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="2.4" fill="var(--brand-2)" opacity="0.55" />
      ))}
    </svg>
  );
}

// --------------------------------------------------------------- Cosmos ----

/**
 * Deterministic star field. Math.random would reshuffle the sky on every
 * re-render, so positions come from a cheap hash of the index instead.
 */
function stars(count: number, w: number, h: number, seed: number) {
  const out: { cx: number; cy: number; r: number; o: number }[] = [];
  for (let i = 1; i <= count; i++) {
    const a = Math.sin(i * 12.9898 + seed) * 43758.5453;
    const b = Math.sin(i * 78.233 + seed) * 24634.6345;
    const c = Math.sin(i * 45.164 + seed) * 15731.743;
    out.push({
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
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={svgId('nebula')} cx="72%" cy="30%" r="55%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${svgId('nebula')})`} />
      {stars(46, 400, 200, 3).map((s, i) => (
        <circle
          key={i}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill="var(--text-bright)"
          opacity={s.o}
        />
      ))}
      {/* Orbit rings, tilted so they read as a system rather than flat circles. */}
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
      {/* Crescent: a lit disc with the shadow disc punched over it. */}
      <g transform="translate(76 138)">
        <circle r="22" fill="var(--brand-2)" opacity="0.5" />
        <circle cx="9" cy="-6" r="20" fill="var(--background)" />
      </g>
    </svg>
  );
}

export function CosmosSidebar() {
  // Compact and bottom-anchored — see BloomSidebar.
  return (
    <svg viewBox="0 0 60 160" preserveAspectRatio="xMidYMax slice">
      {stars(16, 60, 160, 9).map((s, i) => (
        <circle
          key={i}
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
  // Sparkles in --brand-2, not --text-bright: on a pale header the ink token
  // is near-black, so the star field came out as grey dust. The brand tokens
  // stay recognisably celestial in both modes.
  //
  // A wide viewBox keeps the stretch from preserveAspectRatio="none" mild at
  // realistic window widths; nothing here is a continuous stroke, so an opaque
  // tab pill passing over it just hides a shape rather than cutting a line.
  const sparkle = (x: number, y: number, r: number, o: number) => (
    <path
      key={`${x}-${y}`}
      d={`M${x} ${y - r} q${r * 0.2} ${r * 0.8} ${r} ${r} q${-r * 0.8} ${r * 0.2} ${-r} ${r} q${-r * 0.2} ${-r * 0.8} ${-r} ${-r} q${r * 0.8} ${-r * 0.2} ${r} ${-r} Z`}
      fill="var(--brand-2)"
      opacity={o}
    />
  );

  return (
    <svg viewBox="0 0 1600 46" preserveAspectRatio="none">
      <defs>
        <radialGradient id={svgId('hdr')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="1180" cy="20" rx="440" ry="46" fill={`url(#${svgId('hdr')})`} />

      {sparkle(250, 16, 7, 0.5)}
      {sparkle(430, 32, 4.5, 0.38)}
      {sparkle(690, 13, 5.5, 0.42)}
      {sparkle(905, 30, 8, 0.55)}
      {sparkle(1120, 15, 5, 0.4)}
      {sparkle(1330, 31, 6.5, 0.5)}
      {sparkle(1520, 17, 4.5, 0.36)}

      {[
        [340, 30],
        [560, 12],
        [800, 34],
        [1030, 11],
        [1250, 33],
        [1450, 12],
      ].map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="2.2"
          fill="var(--brand)"
          opacity="0.45"
        />
      ))}

      {/* Crescent, punched with the header's own surface colour. */}
      <g transform="translate(1420 23)">
        <circle r="13" fill="var(--brand-2)" opacity="0.5" />
        <circle cx="6" cy="-4" r="11.5" fill="var(--background)" />
      </g>
    </svg>
  );
}

// --------------------------------------------------------------- Doodle ----

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
        {/* Smiling cloud. */}
        <path d="M72 92 a20 20 0 0 1 34 -14 a16 16 0 0 1 26 10 a15 15 0 0 1 -4 29 h-46 a17 17 0 0 1 -10 -25 Z" />
        <path d="M92 100 q6 7 13 0" />
        <circle cx="88" cy="90" r="1.8" fill="var(--brand-2)" />
        <circle cx="108" cy="90" r="1.8" fill="var(--brand-2)" />
        {/* Squiggle. */}
        <path d="M150 152 q14 -20 28 0 t28 0 t28 0" />
        {/* Zigzag. */}
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
        {/* Four-point sparkles: two crossed diamonds each. */}
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
  // Compact and bottom-anchored — see BloomSidebar.
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
  // Discrete marks over the wash — see BloomHeader on why these survive a tab
  // pill where a continuous stroke would not.
  const svgId = useSvgIds();
  const spark = (x: number, y: number, r: number, o: number) => (
    <path
      key={`s${x}`}
      d={`M${x} ${y - r} q${r * 0.2} ${r * 0.8} ${r} ${r} q${-r * 0.8} ${r * 0.2} ${-r} ${r} q${-r * 0.2} ${-r * 0.8} ${-r} ${-r} q${r * 0.8} ${-r * 0.2} ${r} ${-r} Z`}
      fill="var(--brand-2)"
      opacity={o}
    />
  );
  return (
    <svg viewBox="0 0 1600 46" preserveAspectRatio="none">
      <defs>
        <radialGradient id={svgId('a')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand-2)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--brand-2)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={svgId('b')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="280" cy="24" rx="420" ry="42" fill={`url(#${svgId('a')})`} />
      <ellipse cx="1000" cy="30" rx="460" ry="44" fill={`url(#${svgId('b')})`} />
      <ellipse cx="1540" cy="18" rx="360" ry="38" fill={`url(#${svgId('a')})`} />
      {spark(200, 24, 8, 0.7)}
      {spark(620, 30, 6, 0.55)}
      {spark(1060, 16, 7, 0.6)}
      {spark(1420, 28, 8.5, 0.7)}
      <circle cx="400" cy="30" r="8" fill="var(--brand)" opacity="0.5" />
      <circle cx="1230" cy="20" r="6" fill="var(--brand)" opacity="0.45" />
      <rect x="820" y="14" width="13" height="13" rx="4" fill="var(--brand-2)" opacity="0.5" transform="rotate(16 826 20)" />
      <rect x="1330" y="26" width="10" height="10" rx="3" fill="var(--brand-2)" opacity="0.45" transform="rotate(-14 1335 31)" />
    </svg>
  );
}

// ------------------------------------------------------------- page art ----
// Wider and shorter than the workspace hero: these sit behind real content, so
// everything hugs the edges and the middle band stays clear.

export function BloomPage() {
  const stem = (x: number, y: number, scale: number, flip: boolean) => (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
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

export function CosmosPage() {
  const svgId = useSvgIds();
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={svgId('page')} cx="82%" cy="16%" r="58%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="700" fill={`url(#${svgId('page')})`} />
      {stars(120, 1200, 700, 11).map((s, i) => (
        <circle
          key={i}
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

// --------------------------------------------------------------- Summit ----
//
// The ridgelines are generated, not hand-typed. Hand-placed vertices come out
// as regular zigzags — recognisably origami rather than rock — so each range
// is built by midpoint displacement: repeatedly split every segment and push
// the new midpoint off the line by a shrinking random amount. That is the
// standard way to get a fractal terrain silhouette, and it is what gives the
// irregular peak spacing and broken slopes a real range has.
//
// The randomness is seeded and the ranges are computed once at module load, so
// the skyline is stable across renders and across sessions.

/** mulberry32 — small, fast, and repeatable from a fixed seed. */
function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

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

/** Closed silhouette: the ridge, then down to the baseline and back. */
function silhouette(pts: Pt[], width: number, base: number): string {
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} L${width} ${base} L0 ${base} Z`;
}

/**
 * Shaded faces. With light coming from the left, every slope that descends to
 * the right is in shadow — so each of those segments gets its own darker
 * polygon down to the baseline. Per-face shading following the real silhouette
 * is what stops a range reading as one flat cutout.
 */
function shadowFaces(pts: Pt[], base: number): string {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [xa, ya] = pts[i];
    const [xb, yb] = pts[i + 1];
    if (yb <= ya) continue; // uphill to the right = lit
    d += `M${xa.toFixed(1)} ${ya.toFixed(1)} L${xb.toFixed(1)} ${yb.toFixed(1)} L${xb.toFixed(1)} ${base} L${xa.toFixed(1)} ${base} Z `;
  }
  return d.trim();
}

/**
 * Rescale a generated profile to exactly fill [yTop, yBottom].
 *
 * Raw midpoint displacement gives relief that depends on seed luck — one seed
 * produced a "range" spanning 18px of a 200px box, which is a bumpy line, not
 * a mountain. Normalising keeps the fractal irregularity but makes the height
 * of each range a design decision rather than a lottery.
 */
function normalize(pts: Pt[], yTop: number, yBottom: number): Pt[] {
  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...ys);
  const span = Math.max(...ys) - lo || 1;
  return pts.map(([x, y]) => [
    x,
    yTop + ((y - lo) / span) * (yBottom - yTop),
  ]);
}

/**
 * Snowline as its own low-amplitude ridgeline rather than a straight cut, so
 * snow reaches further down the gullies than it does on the spurs — which is
 * where the tongued lower edge of a real snowfield comes from.
 *
 * It is placed as a fraction of the range's own relief, never at an absolute
 * y: a hardcoded line sat above every peak and no snow drew at all.
 */
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
    snow: sp.snow
      ? snowMask(sp.seed + 991, width, sp.yTop, sp.yBottom)
      : null,
  }));
}

// Computed once: a stable skyline beats a different mountain on every render.
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

// The summits the trekkers stand on, resolved from the generated ridgelines.
const WORKSPACE_SUMMIT = peakNear(WORKSPACE_RANGES[2].pts, 296);
const PAGE_SUMMIT = peakNear(PAGE_RANGES[2].pts, 872);

/**
 * The highest point of the ridge nearest `targetX`. Lets a figure be planted on
 * the terrain rather than at a guessed coordinate — the ridgelines are
 * generated, so no hand-picked y would stay on the rock.
 */
function peakNear(pts: Pt[], targetX: number): Pt {
  let best: Pt = pts[0];
  let bestDist = Infinity;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    if (y >= pts[i - 1][1] || y >= pts[i + 1][1]) continue; // not a local peak
    const dist = Math.abs(x - targetX);
    if (dist < bestDist) {
      bestDist = dist;
      best = pts[i];
    }
  }
  return best;
}

/**
 * A trekker, mid-stride with a pack and a pole. Drawn as a filled silhouette
 * with no interior detail: at this scale any line work turns to mud, and the
 * outline alone is what makes the figure legible against the sky.
 *
 * Local units are 10 tall with the feet at the origin, so `h` is the figure's
 * height in the parent viewBox and everything scales from it.
 */
function Trekker({ x, y, h }: { x: number; y: number; h: number }) {
  const u = h / 10;
  return (
    <g
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${u.toFixed(3)})`}
      fill="var(--text-faintest)"
      opacity="0.95"
    >
      {/* Pole first so the hand overlaps it. */}
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

/**
 * A flock. Positions are jittered from a seeded generator rather than spaced
 * evenly — birds in a line read as a decoration, birds in a loose cluster read
 * as birds. Size and opacity vary together so the smaller ones sit further back.
 */
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
  const rand = rng(seed);
  return (
    <g fill="none" stroke="var(--text-faintest)" strokeLinecap="round">
      {Array.from({ length: count }, (_, i) => {
        const bx = x + (rand() - 0.5) * spread;
        const by = y + (rand() - 0.5) * spread * 0.42;
        const s = scale * (0.55 + rand() * 0.75);
        return (
          <path
            key={i}
            d={`M${(bx - 3 * s).toFixed(1)} ${by.toFixed(1)} q${(1.5 * s).toFixed(1)} ${(-1.9 * s).toFixed(1)} ${(3 * s).toFixed(1)} 0 q${(1.5 * s).toFixed(1)} ${(-1.9 * s).toFixed(1)} ${(3 * s).toFixed(1)} 0`}
            strokeWidth={Math.max(0.35, 0.42 * s)}
            opacity={0.3 + s / scale / 3}
          />
        );
      })}
    </g>
  );
}

/**
 * Valley mist: a soft band in the surface colour pooling at the base of a
 * range. Real haze collects in valleys rather than sitting evenly over the
 * scene, and it is what separates one range from the next at a glance.
 */
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
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} opacity={opacity} />
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
      <path d={shadowFaces(spec.pts, base)} fill="var(--text-faintest)" opacity="0.5" />
      {spec.snow && <path d={body} fill={snowColor} opacity="0.85" clipPath={`url(#${id})`} />}
    </g>
  );
}

/**
 * Haze between ranges. Real aerial perspective washes out the base of a distant
 * range far more than its peaks, which a flat opacity drop cannot reproduce.
 */
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

/** Low sun: no hard rim, just a soft core inside a wide falloff. */
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

/** Conifers — layered tiers with a trunk, varied by index so no two match. */
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
            <rect x={x - s * 0.035} y={base - s * 0.22} width={s * 0.07} height={s * 0.22} />
            <path d={`M${x} ${base - s} L${x + w * 0.6} ${base - s * 0.54} L${x - w * 0.6} ${base - s * 0.54} Z`} />
            <path d={`M${x} ${base - s * 0.79} L${x + w * 0.82} ${base - s * 0.28} L${x - w * 0.82} ${base - s * 0.28} Z`} />
            <path d={`M${x} ${base - s * 0.52} L${x + w} ${base - s * 0.03} L${x - w} ${base - s * 0.03} Z`} />
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
      <Range spec={WORKSPACE_RANGES[0]} width={400} base={200} opacity={0.3} snowColor="var(--background)" id={svgId('snow-ws0')} />
      <Haze y={96} width={400} base={200} id={svgId('haze-ws')} />
      <Range spec={WORKSPACE_RANGES[1]} width={400} base={200} opacity={0.5} snowColor="var(--background)" id={svgId('snow-ws1')} />
      <Mist cx={150} cy={162} rx={190} ry={17} id={svgId('mist-ws')} opacity={0.75} />
      <Range spec={WORKSPACE_RANGES[2]} width={400} base={200} opacity={0.74} snowColor="var(--background)" id={svgId('snow-ws2')} />
      <Trekker x={WORKSPACE_SUMMIT[0]} y={WORKSPACE_SUMMIT[1]} h={11} />
      <Pines xs={[10, 25, 42, 58, 344, 360, 378, 393]} base={200} h={24} opacity={0.85} />
    </svg>
  );
}

export function SummitPage() {
  const svgId = useSvgIds();
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
      <SummitSun cx={936} cy={202} r={30} id={svgId('sun-pg')} />
      <Birds seed={5} count={9} x={318} y={190} spread={300} scale={8} />
      <Range spec={PAGE_RANGES[0]} width={1200} base={700} opacity={0.26} snowColor="var(--background)" id={svgId('snow-pg0')} />
      <Haze y={340} width={1200} base={700} id={svgId('haze-pg')} />
      <Range spec={PAGE_RANGES[1]} width={1200} base={700} opacity={0.44} snowColor="var(--background)" id={svgId('snow-pg1')} />
      <Mist cx={440} cy={552} rx={560} ry={54} id={svgId('mist-pg')} opacity={0.75} />
      <Range spec={PAGE_RANGES[2]} width={1200} base={700} opacity={0.66} snowColor="var(--background)" id={svgId('snow-pg2')} />
      <Trekker x={PAGE_SUMMIT[0]} y={PAGE_SUMMIT[1]} h={34} />
      <Pines xs={[22, 58, 98, 136, 174, 1030, 1070, 1110, 1150, 1186]} base={700} h={74} opacity={0.85} />
    </svg>
  );
}

export function SummitSidebar() {
  // A stand of conifers rather than a range: at 60px wide a mountain reduces to
  // a grey smudge, whereas a treeline still reads at that scale. Two depth
  // rows — a faint back row set higher, a stronger front row — keep it from
  // flattening into a single band.
  return (
    <svg viewBox="0 0 60 160" preserveAspectRatio="xMidYMax slice">
      <Pines xs={[4, 15, 26, 37, 48, 58]} base={148} h={30} opacity={0.3} />
      <Pines xs={[-2, 10, 21, 32, 44, 55]} base={160} h={42} opacity={0.62} />
    </svg>
  );
}

export function SummitHeader() {
  // Birds, echoing the flock in the workspace scene. Small discrete marks —
  // see BloomHeader on why a ridge silhouette could not stay here.
  const svgId = useSvgIds();
  return (
    <svg viewBox="0 0 1600 46" preserveAspectRatio="none">
      <defs>
        <linearGradient id={svgId('haze')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--text-faintest)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--text-faintest)" stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id={svgId('sun')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.42" />
          <stop offset="45%" stopColor="var(--brand)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect y="14" width="1600" height="32" fill={`url(#${svgId('haze')})`} />
      <ellipse cx="1210" cy="20" rx="380" ry="46" fill={`url(#${svgId('sun')})`} />
      <g fill="none" stroke="var(--text-faintest)" strokeLinecap="round">
        {[
          [190, 20, 5],
          [268, 30, 3.4],
          [352, 15, 4.2],
          [640, 27, 4.6],
          [742, 17, 3.2],
          [1010, 29, 5.2],
          [1418, 19, 4],
          [1520, 30, 3],
        ].map(([x, y, sc]) => (
          <path
            key={x}
            d={`M${x - 3 * sc} ${y} q${1.5 * sc} ${-1.9 * sc} ${3 * sc} 0 q${1.5 * sc} ${-1.9 * sc} ${3 * sc} 0`}
            strokeWidth={Math.max(0.9, 0.42 * sc)}
            opacity={0.4 + sc / 16}
          />
        ))}
      </g>
    </svg>
  );
}

// ------------------------------------------------------------- Altitude ----
//
// Sunset at cruising height: layered cloud banks with lit rims, a low sun, and
// an airliner passing. Geometry and gradients only — no SVG filters.
//
// Two techniques carry the whole thing:
//
// 1. A cumulus is a union of overlapping circles that all share one fill, with
//    the opacity applied to the *group*. Per-circle opacity would make every
//    overlap visible as a seam; one group opacity lets them merge into a single
//    silhouette.
//
// 2. The lit rim is the same cloud drawn twice — a bright copy offset toward
//    the sun, then the body over the top. What survives is a crescent of light
//    along the sunward edge, which is what makes a cloud read as three
//    dimensional rather than as a blob.

/** Lobes of one cumulus: a flat base with bulges, biggest near the middle. */
function cumulus(seed: number, w: number, h: number) {
  const rand = rng(seed);
  const lobes: { cx: number; cy: number; r: number }[] = [];
  const n = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // A bell over the width, so the stack peaks in the centre and tapers out.
    const bell = Math.sin(t * Math.PI) ** 0.7;
    const r = h * (0.3 + bell * 0.72) * (0.78 + rand() * 0.44);
    lobes.push({
      cx: w * (0.06 + t * 0.88) + (rand() - 0.5) * w * 0.07,
      cy: h - r * (0.52 + rand() * 0.3),
      r,
    });
  }
  // A wide flat lobe welds the bases into one mass instead of a row of balls.
  lobes.push({ cx: w * 0.5, cy: h - h * 0.16, r: Math.max(w * 0.3, h * 0.42) });
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
  /** Rim offset toward the sun, in scene units. */
  rim: number;
}) {
  const lobes = cumulus(seed, w, h);
  const puffs = (fill: string, dx: number, dy: number) => (
    <g fill={fill} transform={`translate(${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)})`}>
      {lobes.map((l, i) => (
        <circle key={i} cx={l.cx} cy={l.cy} r={l.r} />
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

/**
 * Airliner in plan view, nose up. Plan view is deliberate: it is symmetric, so
 * the silhouette is a shape rather than a likeness, and it stays legible at the
 * size a distant aircraft actually occupies.
 */
const PLANE =
  // fuselage
  'M100 4 C108 4 112 20 113 42 L115 152 C115 170 108 182 100 182 ' +
  'C92 182 85 170 85 152 L87 42 C88 20 92 4 100 4 Z ' +
  // wings, swept back
  'M113 70 L197 133 L198 144 L112 116 Z ' +
  'M87 70 L3 133 L2 144 L88 116 Z ' +
  // tailplanes
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
      {/* Contrails, tapering and fading behind the engines. */}
      {[-1, 1].map((side) => (
        <path
          key={side}
          d={`M${side * size * 0.19} ${size * 0.34} L${side * size * 0.26} ${size * 2.6} L${side * size * 0.12} ${size * 2.6} Z`}
          fill={`url(#${svgId('trail')})`}
        />
      ))}
      <g transform={`translate(${-size / 2} ${-size / 2}) scale(${s})`}>
        <path d={PLANE} fill="var(--text-faintest)" />
        {/* Engine pods. */}
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
        {/* Sun catching the leading edges. */}
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
          <stop offset="0%" stopColor="var(--text-faintest)" stopOpacity="0.26" />
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
      <ellipse cx={w * 0.78} cy={h * 0.3} rx={w * 0.4} ry={h * 0.5} fill={`url(#${svgId('sun')})`} />

      {/* Far bank: small, faint, high — the horizon of the cloudscape. */}
      <Cloud x={w * -0.04} y={h * 0.44} w={w * 0.34} h={h * 0.1} seed={5} opacity={0.16} rim={rim * 0.6} />
      <Cloud x={w * 0.44} y={h * 0.4} w={w * 0.38} h={h * 0.11} seed={9} opacity={0.16} rim={rim * 0.6} />

      {detail && <Plane x={w * 0.79} y={h * 0.19} size={h * 0.17} rotate={-24} svgId={svgId} />}

      {/* Mid bank. */}
      <Cloud x={w * 0.06} y={h * 0.74} w={w * 0.42} h={h * 0.2} seed={17} opacity={0.3} rim={rim} />
      <Cloud x={w * 0.58} y={h * 0.72} w={w * 0.46} h={h * 0.22} seed={23} opacity={0.3} rim={rim} />

      {/* Near bank, running off both edges so the frame does not bound it. */}
      <Cloud x={w * -0.12} y={h * 1.02} w={w * 0.66} h={h * 0.3} seed={31} opacity={0.5} rim={rim * 1.3} />
      <Cloud x={w * 0.48} y={h * 1.06} w={w * 0.72} h={h * 0.34} seed={37} opacity={0.5} rim={rim * 1.3} />
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

export function AltitudePage() {
  const svgId = useSvgIds();
  return (
    <svg viewBox="0 0 1400 780" preserveAspectRatio="xMidYMid slice">
      <SkyScene w={1400} h={780} svgId={svgId} />
    </svg>
  );
}

export function AltitudeSidebar() {
  // Its own cut-down scene rather than the full one: at 60px wide most of the
  // cloudscape falls outside the strip, so rendering all six banks only cost
  // elements on an always-mounted surface.
  const svgId = useSvgIds();
  return (
    <svg viewBox="0 0 60 200" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id={svgId('sky')} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="var(--text-faintest)" stopOpacity="0.26" />
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
  // Small cloud puffs and one distant aircraft. Discrete shapes — see
  // BloomHeader on why nothing continuous can live at this size.
  const svgId = useSvgIds();
  return (
    <svg viewBox="0 0 1600 46" preserveAspectRatio="none">
      <defs>
        <linearGradient id={svgId('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--text-faintest)" stopOpacity="0.24" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.16" />
        </linearGradient>
        <radialGradient id={svgId('sun')} cx="76%" cy="70%" r="46%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.36" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={svgId('trail')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="46" fill={`url(#${svgId('sky')})`} />
      <rect width="1600" height="46" fill={`url(#${svgId('sun')})`} />
      {[
        [120, 44, 17, 17],
        [520, 46, 14, 23],
        [900, 42, 12, 31],
        [1330, 46, 16, 37],
      ].map(([x, y, h, seed]) => (
        <Cloud key={x} x={x} y={y} w={h * 4.2} h={h} seed={seed} opacity={0.5} rim={1.6} />
      ))}
      <Plane x={1150} y={17} size={22} rotate={-24} svgId={svgId} />
    </svg>
  );
}

export function TerctlLogo({ size = 30 }: { size?: number; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      style={{ flexShrink: 0, display: "block" }}
      aria-label="TerCTL"
    >
      {/* top / bottom walls */}
      <rect x="0" y="0" width="64" height="14" />
      <rect x="0" y="50" width="64" height="14" />
      {/* left wall, split */}
      <rect x="0" y="14" width="10" height="11" />
      <rect x="0" y="39" width="10" height="11" />
      {/* right wall, split */}
      <rect x="54" y="14" width="10" height="11" />
      <rect x="54" y="39" width="10" height="11" />
    </svg>
  );
}

const LOADER_PIECES = [
  { x: 0, y: 0, w: 64, h: 14, anim: "slideTop" },
  { x: 0, y: 50, w: 64, h: 14, anim: "slideBottom" },
  { x: 54, y: 14, w: 10, h: 11, anim: "slideRight" },
  { x: 54, y: 39, w: 10, h: 11, anim: "slideRight" },
  { x: 0, y: 39, w: 10, h: 11, anim: "slideLeft" },
  { x: 0, y: 14, w: 10, h: 11, anim: "slideLeft" },
];

export function TerctlLoader({ size = 64, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      style={{
        display: "block",
        filter: glow ? "drop-shadow(0 0 14px currentColor)" : undefined,
      }}
      aria-label="Loading"
    >
      {LOADER_PIECES.map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          style={{ animation: `${p.anim} 2.4s ease-in-out infinite` }}
        />
      ))}
    </svg>
  );
}

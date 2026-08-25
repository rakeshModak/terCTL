import type { ReactNode } from 'react';
import { IS_MAC } from '../../../lib/platform';

export type Motif = {
  at: number;
  size: number;
  opacity?: number;
  y?: number;
  draw: ReactNode;
};

export function HeaderBand({
  wash,
  motifs = [],
}: {
  wash?: ReactNode;
  motifs?: Motif[];
}) {
  const leadIn = IS_MAC ? 96 : 104;
  const tailOut = IS_MAC ? 40 : 150;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        maskImage: `linear-gradient(to right, transparent 0px, #000 ${leadIn}px, #000 calc(100% - ${tailOut}px), transparent 100%)`,
        WebkitMaskImage: `linear-gradient(to right, transparent 0px, #000 ${leadIn}px, #000 calc(100% - ${tailOut}px), transparent 100%)`,
      }}
    >
      {wash && (
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 1600 46"
          preserveAspectRatio="none"
        >
          {wash}
        </svg>
      )}

      {motifs.map((m) => (
        <svg
          key={m.at}
          viewBox="0 0 100 100"
          width={m.size}
          height={m.size}
          className="absolute"
          style={{
            left: `${m.at * 100}%`,
            top: `${(m.y ?? 0.5) * 100}%`,
            transform: 'translate(-50%, -50%)',
            opacity: m.opacity ?? 1,
          }}
        >
          {m.draw}
        </svg>
      ))}
    </div>
  );
}

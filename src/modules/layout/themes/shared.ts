import { useId } from 'react';

export function useSvgIds(): (name: string) => string {
  const uid = useId().replace(/:/g, '');
  return (name: string) => `terctl-${uid}-${name}`;
}

export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Accent presets — each is a {color, gradient-end} pair so buttons/logo keep a
// vivid two-tone gradient. Muted, desaturated "futurist" palette — same hues as
// before but softened so they read as sophisticated rather than neon-bright.
export const ACCENTS: Record<string, { c: string; c2: string }> = {
  Ember: { c: '#d9795f', c2: '#c65f80' },
  Emerald: { c: '#4bb890', c2: '#3ba7b0' },
  Azure: { c: '#6389c9', c2: '#7568c0' },
  Amber: { c: '#cba062', c2: '#c67d64' },
  Violet: { c: '#9585c4', c2: '#b378a6' },
  Neon: { c: '#4aacbd', c2: '#5379ba' },
  Magenta: { c: '#c56e96', c2: '#8f6bb0' },
  Toxic: { c: '#96b56a', c2: '#4aacbd' },
  Rose: { c: '#c9757f', c2: '#b85c68' },
  Gold: { c: '#c7a45f', c2: '#bd894e' },
  Aqua: { c: '#4bb0a4', c2: '#4bb58e' },
  Fuchsia: { c: '#b268bf', c2: '#8168bd' },
  Plasma: { c: '#7982c4', c2: '#b078bf' },
  Solar: { c: '#cf7e54', c2: '#c7a25a' },
  // Muted jade-green (the glowing bar) and a monochrome silver (editorial B&W).
  Jade: { c: '#43ab88', c2: '#2f8a70' },
  Chrome: { c: '#dfe3ea', c2: '#a3adbb' },
}

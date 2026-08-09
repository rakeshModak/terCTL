export interface AccentPair {
  c: string;
  c2: string;
}

export interface Accent {
  dark: AccentPair;
  light: AccentPair;
}

export const ACCENTS: Record<string, Accent> = {
  Ember: {
    dark: { c: '#d9795f', c2: '#c65f80' },
    light: { c: '#c63c16', c2: '#bd1d50' },
  },
  Emerald: {
    dark: { c: '#4bb890', c2: '#3ba7b0' },
    light: { c: '#187b57', c2: '#0f6c74' },
  },
  Azure: {
    dark: { c: '#6389c9', c2: '#7568c0' },
    light: { c: '#1f66de', c2: '#5f4bd7' },
  },
  Amber: {
    dark: { c: '#cba062', c2: '#c67d64' },
    light: { c: '#976113', c2: '#aa401c' },
  },
  Violet: {
    dark: { c: '#9585c4', c2: '#b378a6' },
    light: { c: '#7557cd', c2: '#a4348c' },
  },
  Neon: {
    dark: { c: '#4aacbd', c2: '#5379ba' },
    light: { c: '#167889', c2: '#275ebe' },
  },
  Magenta: {
    dark: { c: '#c56e96', c2: '#8f6bb0' },
    light: { c: '#c82872', c2: '#833fc2' },
  },
  Toxic: {
    dark: { c: '#96b56a', c2: '#4aacbd' },
    light: { c: '#567726', c2: '#146c7b' },
  },
  Rose: {
    dark: { c: '#c9757f', c2: '#b85c68' },
    light: { c: '#cf283c', c2: '#b62c3e' },
  },
  Gold: {
    dark: { c: '#c7a45f', c2: '#bd894e' },
    light: { c: '#8e6615', c2: '#8b5518' },
  },
  Aqua: {
    dark: { c: '#4bb0a4', c2: '#4bb58e' },
    light: { c: '#1c796e', c2: '#186f4f' },
  },
  Fuchsia: {
    dark: { c: '#b268bf', c2: '#8168bd' },
    light: { c: '#b02ec7', c2: '#6e44d1' },
  },
  Plasma: {
    dark: { c: '#7982c4', c2: '#b078bf' },
    light: { c: '#5261d4', c2: '#9733b1' },
  },
  Solar: {
    dark: { c: '#cf7e54', c2: '#c7a25a' },
    light: { c: '#b64b14', c2: '#825b11' },
  },
  Jade: {
    dark: { c: '#43ab88', c2: '#2f8a70' },
    light: { c: '#187b5a', c2: '#0f6f54' },
  },
  Chrome: {
    dark: { c: '#dfe3ea', c2: '#a3adbb' },
    light: { c: '#606d85', c2: '#586372' },
  },
};

export const DEFAULT_ACCENT = 'Chrome';

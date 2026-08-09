
export interface ThemeSurfaces {
  background: string;
  card: string;
  popover: string;
  secondary: string;
  accentSurface: string;
  sidebar: string;
  sidebarAccent: string;
  deep: string;
}

export interface ThemePalette {
  slug: string;
  dark: ThemeSurfaces;
  light: ThemeSurfaces;
}

export const THEMES: Record<string, ThemePalette> = {
  Midnight: {
    slug: '',
    dark: {
      background: '#0a0c10',
      card: '#0e1116',
      popover: '#12151b',
      secondary: '#101319',
      accentSurface: '#151922',
      sidebar: '#0c0e13',
      sidebarAccent: '#151922',
      deep: '#08090c',
    },
    light: {
      background: '#f5f8fb',
      card: '#fcfdfe',
      popover: '#ffffff',
      secondary: '#eef2f8',
      accentSurface: '#e4ebf4',
      sidebar: '#f0f4f9',
      sidebarAccent: '#dce5f1',
      deep: '#e9eff6',
    },
  },
  Graphite: {
    slug: 'graphite',
    dark: {
      background: '#17181b',
      card: '#202127',
      popover: '#26272e',
      secondary: '#23242b',
      accentSurface: '#2a2b33',
      sidebar: '#1c1d21',
      sidebarAccent: '#2a2b33',
      deep: '#101113',
    },
    light: {
      background: '#f9f8f7',
      card: '#fdfdfd',
      popover: '#ffffff',
      secondary: '#f4f3f2',
      accentSurface: '#eeecea',
      sidebar: '#f5f4f3',
      sidebarAccent: '#e9e6e4',
      deep: '#f1f0ee',
    },
  },
  'Nord Deep': {
    slug: 'nord',
    dark: {
      background: '#1b2230',
      card: '#273244',
      popover: '#2e3a52',
      secondary: '#2b3750',
      accentSurface: '#33405b',
      sidebar: '#222b3a',
      sidebarAccent: '#33405b',
      deep: '#141a25',
    },
    light: {
      background: '#f5f9fa',
      card: '#fdfefe',
      popover: '#ffffff',
      secondary: '#eff5f7',
      accentSurface: '#e5f0f2',
      sidebar: '#f1f6f8',
      sidebarAccent: '#deebef',
      deep: '#eaf3f5',
    },
  },
  Obsidian: {
    slug: 'obsidian',
    dark: {
      background: '#0b0b0d',
      card: '#141417',
      popover: '#1a1a1f',
      secondary: '#17171b',
      accentSurface: '#1e1e24',
      sidebar: '#101013',
      sidebarAccent: '#1e1e24',
      deep: '#050506',
    },
    light: {
      background: '#f8f8f8',
      card: '#fdfdfd',
      popover: '#ffffff',
      secondary: '#f3f3f3',
      accentSurface: '#ececec',
      sidebar: '#f4f4f4',
      sidebarAccent: '#e6e6e6',
      deep: '#f0f0f0',
    },
  },
  Void: {
    slug: 'void',
    dark: {
      background: '#0d0a16',
      card: '#171126',
      popover: '#201735',
      secondary: '#1b142d',
      accentSurface: '#261c3f',
      sidebar: '#130f20',
      sidebarAccent: '#261c3f',
      deep: '#08060f',
    },
    light: {
      background: '#f8f5fb',
      card: '#fdfcfe',
      popover: '#ffffff',
      secondary: '#f3edf8',
      accentSurface: '#ece3f4',
      sidebar: '#f5f0f9',
      sidebarAccent: '#e7dbf1',
      deep: '#f0e9f6',
    },
  },
  'Deep Space': {
    slug: 'space',
    dark: {
      background: '#0a0e1a',
      card: '#121829',
      popover: '#1a2238',
      secondary: '#151d31',
      accentSurface: '#1f2844',
      sidebar: '#0e1322',
      sidebarAccent: '#1f2844',
      deep: '#060912',
    },
    light: {
      background: '#f5f5fb',
      card: '#fdfdfe',
      popover: '#ffffff',
      secondary: '#eeeef7',
      accentSurface: '#e5e5f3',
      sidebar: '#f0f0f8',
      sidebarAccent: '#ddddf0',
      deep: '#eaeaf6',
    },
  },
  Abyss: {
    slug: 'abyss',
    dark: {
      background: '#071414',
      card: '#0f2323',
      popover: '#173131',
      secondary: '#132a2a',
      accentSurface: '#1c3b3b',
      sidebar: '#0b1c1c',
      sidebarAccent: '#1c3b3b',
      deep: '#041010',
    },
    light: {
      background: '#f5fafa',
      card: '#fdfefe',
      popover: '#ffffff',
      secondary: '#eff7f7',
      accentSurface: '#e5f2f2',
      sidebar: '#f1f8f8',
      sidebarAccent: '#deefee',
      deep: '#eaf5f5',
    },
  },
  Plum: {
    slug: 'plum',
    dark: {
      background: '#140a12',
      card: '#241320',
      popover: '#311b2c',
      secondary: '#2a1726',
      accentSurface: '#3a2035',
      sidebar: '#1d0f1a',
      sidebarAccent: '#3a2035',
      deep: '#0d060b',
    },
    light: {
      background: '#fbf5f8',
      card: '#fefdfd',
      popover: '#ffffff',
      secondary: '#f7eef3',
      accentSurface: '#f3e5ec',
      sidebar: '#f8f0f5',
      sidebarAccent: '#f0dde7',
      deep: '#f6eaf0',
    },
  },
  Carbon: {
    slug: 'carbon',
    dark: {
      background: '#0a0a0b',
      card: '#141416',
      popover: '#1a1a1d',
      secondary: '#171719',
      accentSurface: '#1f1f22',
      sidebar: '#0f0f11',
      sidebarAccent: '#1f1f22',
      deep: '#050505',
    },
    light: {
      background: '#f7f8f9',
      card: '#fdfdfd',
      popover: '#ffffff',
      secondary: '#f2f3f4',
      accentSurface: '#eaecee',
      sidebar: '#f3f4f5',
      sidebarAccent: '#e4e6e9',
      deep: '#eeeff1',
    },
  },
  Forest: {
    slug: 'forest',
    dark: {
      background: '#080b09',
      card: '#0f1611',
      popover: '#152018',
      secondary: '#121a14',
      accentSurface: '#1a271d',
      sidebar: '#0c110e',
      sidebarAccent: '#1a271d',
      deep: '#040605',
    },
    light: {
      background: '#f6faf7',
      card: '#fdfefd',
      popover: '#ffffff',
      secondary: '#eff6f1',
      accentSurface: '#e6f2ea',
      sidebar: '#f1f8f3',
      sidebarAccent: '#dfeee3',
      deep: '#ebf4ee',
    },
  },
};

export const DEFAULT_THEME = 'Carbon';

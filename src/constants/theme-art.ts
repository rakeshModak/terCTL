import type { ReactNode } from 'react';
import {
  BloomHeader,
  BloomPage,
  BloomSidebar,
  BloomWorkspace,
  CosmosHeader,
  CosmosPage,
  CosmosSidebar,
  CosmosWorkspace,
  DoodleHeader,
  DoodlePage,
  DoodleSidebar,
  DoodleWorkspace,
  AltitudeHeader,
  AltitudePage,
  AltitudeSidebar,
  AltitudeWorkspace,
  SummitHeader,
  SummitPage,
  SummitSidebar,
  SummitWorkspace,
} from '../modules/layout/themes';

export type ArtSlot = 'workspace' | 'page' | 'sidebar' | 'header';

const SLOT_OPACITY: Record<ArtSlot, number> = {
  workspace: 0.6,
  page: 0.34,
  sidebar: 0.28,
  header: 0.2,
};

type Scenes = Partial<Record<ArtSlot, () => ReactNode>>;

const THEME_ART: Record<string, Scenes> = {
  Bloom: {
    workspace: BloomWorkspace,
    page: BloomPage,
    sidebar: BloomSidebar,
    header: BloomHeader,
  },
  Cosmos: {
    workspace: CosmosWorkspace,
    page: CosmosPage,
    sidebar: CosmosSidebar,
    header: CosmosHeader,
  },
  Altitude: {
    workspace: AltitudeWorkspace,
    page: AltitudePage,
    sidebar: AltitudeSidebar,
    header: AltitudeHeader,
  },
  Summit: {
    workspace: SummitWorkspace,
    page: SummitPage,
    sidebar: SummitSidebar,
    header: SummitHeader,
  },
  Doodle: {
    workspace: DoodleWorkspace,
    page: DoodlePage,
    sidebar: DoodleSidebar,
    header: DoodleHeader,
  },
};

export function themeArt(theme: string, slot: ArtSlot) {
  const scene = THEME_ART[theme]?.[slot];
  return scene ? { Scene: scene, opacity: SLOT_OPACITY[slot] } : null;
}

export function hasThemeArt(theme: string): boolean {
  return theme in THEME_ART;
}

export function themeArtScene(theme: string, slot: ArtSlot) {
  return THEME_ART[theme]?.[slot] ?? null;
}

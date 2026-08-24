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
} from '../components/chrome/theme-scenes';

/**
 * Which artwork an illustrated theme shows, and where.
 *
 * Three slots, in descending order of how much room they get. Nothing renders
 * behind a terminal — glyph legibility beats decoration everywhere.
 */
export type ArtSlot = 'workspace' | 'page' | 'sidebar' | 'header';

/** Per-slot opacity. Art is a backdrop; it must never compete with controls. */
const SLOT_OPACITY: Record<ArtSlot, number> = {
  workspace: 0.6,
  // `page` sits behind real content — cards, tables, body copy — so it stays
  // well below the others and its scenes keep the middle band clear.
  page: 0.34,
  sidebar: 0.28,
  header: 0.35,
};

type Scenes = Partial<Record<ArtSlot, () => ReactNode>>;

/**
 * Keyed by theme name, matching the keys in `THEMES`. A theme with no entry
 * renders nothing at all — that is how every pre-existing theme stays exactly
 * as it was.
 */
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

/**
 * The scene alone, without the slot's backdrop opacity — a settings preview
 * wants the artwork at full strength, not at the weight it sits behind the UI.
 */
export function themeArtScene(theme: string, slot: ArtSlot) {
  return THEME_ART[theme]?.[slot] ?? null;
}

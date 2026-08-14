const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const IS_WINDOWS = /Windows/i.test(ua);
export const IS_MAC = /Macintosh|Mac OS X/i.test(ua);
export const IS_LINUX = !IS_WINDOWS && !IS_MAC;

// Label for the local machine (Transfer's "this computer" pane).
export const LOCAL_MACHINE_LABEL = IS_MAC
  ? 'This Mac'
  : IS_WINDOWS
    ? 'This PC'
    : 'This Machine';

// Primary modifier key: ⌘ on macOS, Ctrl elsewhere.
export const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl';

// Command-palette shortcut hint shown in the title bar.
export const PALETTE_HINT = IS_MAC ? '⌘K' : 'Ctrl K';

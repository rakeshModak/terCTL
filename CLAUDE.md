# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

TerCTL is a desktop SSH client and terminal manager built with Tauri 2 — a React 19
frontend in `src/` talking to a Rust backend in `src-tauri/` over Tauri IPC. It is
not a web app: there is no server, and anything touching the network, filesystem,
PTYs, or the OS keychain lives in Rust.

## Commands

```bash
npm install              # Node 22 (pinned in .node-version)
npm run tauri dev        # full app with hot reload
npm run tauri:dev        # same, but unsets GTK_PATH/GIO_MODULE_DIR (Linux workaround)
npm run dev              # frontend only, in a browser — Tauri IPC calls will fail

npm run build            # tsc -b && vite build  (this is the typecheck gate)
npm run error-check      # tsc -b alone
npm run lint             # eslint --fix over .ts/.tsx
npm run tauri build      # native installer for the current OS
```

There is **no test suite** — no test runner is configured. Verify changes by
building and by exercising the app. Don't claim tests pass; there are none to run.

To typecheck Rust: `cargo check --manifest-path src-tauri/Cargo.toml`.

## Architecture

One-way flow, no shortcuts back up the chain:

```
routes/ ──▶ modules/ ──▶ services/ ──▶ Tauri invoke ──▶ src-tauri/ (Rust)
```

- **`src/routes/`** — TanStack file-based routes: `index`, `hosts`, `sessions`,
  `transfer`, `settings`. `routeTree.gen.ts` is generated; never edit it by hand.
- **`src/modules/`** — one folder per feature (`hosts`, `sessions`, `transfer`,
  `settings`, `layout`). Feature UI and feature-local state live here.
- **`src/services/`** — the only place `invoke()` is called. Each service wraps a
  group of Rust commands behind typed functions.
- **`src/store/`** — Jotai atoms (`app`, `settings`, `dialog`, `updater`, `version`).
- **`src/types/`** — shared domain types. (The README once called this `models/`.)
- **`src/components/ui/`** — shadcn-style primitives. **ESLint ignores this folder**;
  treat it as vendored and prefer regenerating over hand-editing.
- **`src/lib/`** — pure helpers: color math, layout math, path handling, platform
  detection, clipboard, formatting.

Rust side (`src-tauri/src/`): `commands.rs` (hosts, groups, credentials), `ssh.rs`,
`local_term.rs`, `session.rs` (PTY I/O), `sftp.rs`, `metrics.rs`, `backup.rs`,
`store.rs` (SQLite), `vault.rs` (keychain). Every command must be registered in the
`invoke_handler![]` list in `lib.rs` or the frontend cannot reach it.

Terminal output is pushed frontend-ward as Tauri events (`term://output`,
`term://closed`), not returned from `invoke` — sessions are long-lived streams.

## Where data lives

- **Hosts, groups, tags, known-host fingerprints** → SQLite at
  `<app_data_dir>/terctl.db` (`store.rs`).
- **Passwords, key passphrases, private keys** → OS keychain via `keyring`, under
  the `terctl` service prefix (`vault.rs`). **Never write secrets to SQLite, to
  disk, or to logs.** Exported config backups are encrypted with Argon2id +
  XChaCha20-Poly1305 (`backup.rs`).
- **UI preferences** (theme, accent, mode, font size, terminal scheme) → frontend
  settings store, persisted client-side.

## Theming — read this before touching any color

All color is token-driven. `src/lib/theme.ts` generates CSS custom properties and
`applyTheme()` writes them onto `document.documentElement`. Components consume
tokens (`bg-background`, `text-muted-foreground`, `var(--text-dim)`), never literals.

- `src/constants/themes.ts` — each theme has hand-authored `dark` **and** `light`
  surface sets. Light is not derived from dark; deriving it made all ten themes
  collapse into the same off-white.
- `src/constants/accents.ts` — each accent has a `dark` and a `light` pair, tuned so
  light accents clear ~5.2:1 (`c`) and ~6.1:1 (`c2`) on a white card.
- The ink ramp (`text` → `faintest`) is **derived**, not hardcoded: `inkRamp()` runs
  each rung through `ensureContrast()` against that theme's card until it clears the
  floor in `FLOORS`. Adding a theme needs no per-theme ink tuning.
- `src/constants/terminal-schemes.ts` — xterm palettes. Mode-aware: use
  `termTheme(name, mode)` / `termSwatch(name, mode)`. Each scheme derives a full
  16-color ANSI ramp from its own background, and light canvases get a stricter
  bright-rank floor so `green`/`brightGreen` stay distinguishable.

Two invariants worth remembering:

1. **`:root` in `src/index.css` must match what `themeTokens()` emits for Carbon in
   dark mode.** It is the first-paint fallback; drift makes the boot splash flash a
   different palette.
2. **`--accent` must never equal `--popover`.** They were once the same hex in dark
   mode, which made dropdown hover states invisible.

If you change palette values, verify contrast numerically rather than by eye.

## Conventions

- Prettier: single quotes, semicolons, 2-space indent, trailing commas, with
  `prettier-plugin-tailwindcss` for class ordering.
- **`no-console` is an ESLint error.** Use `src/lib/debugLog.ts` or the
  `frontend_log` Tauri command.
- `@typescript-eslint/no-explicit-any` is a warning — don't add new ones.
- Match the surrounding comment density. This codebase explains _why_ a value or
  approach was chosen, especially in the color/layout math; keep that up.
- Prefer real fixes over defensive `try`/`catch` padding.

## Release

`npm run release` (or `:minor` / `:major`) → builds, commits, bumps `package.json`,
tags `vX.Y.Z`, pushes. The tag push triggers `.github/workflows/release.yml`, which
builds on macOS / Ubuntu 22.04 / Windows, uploads to a **draft** release, then a
separate `publish` job flips it public only after all three succeed.

`src-tauri/tauri.conf.json` reads its version from `package.json` — bump one place.
Updater artifacts are signed in CI via `TAURI_SIGNING_PRIVATE_KEY`.

## Gotchas

- `src/routeTree.gen.ts` is generated by the TanStack router plugin.
- The Keys & Identity route was removed in `a48202d`. Don't reintroduce references.
- `src/components/ui/` is outside the lint scope; blanket lint sweeps skip it.
- Linux dev sometimes needs `npm run tauri:dev` rather than `npm run tauri dev` —
  a stray `GTK_PATH` in the environment breaks the WebKit webview.
- The window uses `titleBarStyle: "Overlay"` with custom chrome in
  `src/modules/layout/header.tsx`; drag regions are wired by hand there.

# Contributing to TerCTL

Thanks for taking a look. TerCTL is a small project, so there's no heavy process
here — but a few notes will save you time, and save both of us a round of review.

## Before you start something big

For a bug fix, a rough edge, or a small improvement: just open a PR. No need to ask.

For anything larger — a new feature, a dependency, a restructure — open an issue
first and sketch what you're thinking. It's a lot less painful than finding out
after a weekend of work that it doesn't fit the direction, or that someone else is
already halfway through it.

## Getting set up

You'll need:

- **Node 22.** It's pinned in `.node-version`, so fnm and nvm will switch for you.
- **Rust**, stable — [rustup.rs](https://rustup.rs).
- **Your platform's Tauri toolchain** — see the
  [prerequisites](https://tauri.app/start/prerequisites/). On Debian/Ubuntu that's
  WebKitGTK plus a handful of build packages; the exact list CI installs is in
  [`.github/workflows/release.yml`](.github/workflows/release.yml).

Then:

```bash
npm install
npm run tauri dev
```

Linux, if the window won't come up: use `npm run tauri:dev`. It's the same command
with `GTK_PATH` and `GIO_MODULE_DIR` unset, which some distros set in a way WebKit
chokes on.

`npm run dev` starts the frontend alone in a browser. It's occasionally handy for
pure styling work, but anything calling into Rust will fail — most of the app needs
the real Tauri shell.

## Before you open a PR

```bash
npm run build    # tsc -b && vite build — this is the typecheck gate
npm run lint     # eslint --fix
```

If you touched Rust:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

**There is no test suite.** No runner is configured, so "tests pass" isn't a thing
you can claim here. Say what you actually did to verify the change — which screens
you opened, which hosts you connected to, what you clicked. That's more useful than
a green check would be anyway.

If you're changing something visual, a before/after screenshot goes a long way. If
it's a light/dark thing, please show both.

## How the code is organized

The frontend flows one direction:

```
routes/ ──▶ modules/ ──▶ services/ ──▶ Tauri invoke ──▶ src-tauri/ (Rust)
```

- `src/routes/` — file-based routes. **`routeTree.gen.ts` is generated** — don't
  edit it, and don't be alarmed when it changes.
- `src/modules/` — one folder per feature. Feature UI lives here.
- `src/services/` — the only place `invoke()` gets called. If a component is
  reaching for Tauri directly, that's a sign something belongs in a service.
- `src/store/` — Jotai atoms for cross-feature state.
- `src/lib/` — pure helpers. Color math, layout math, path handling, formatting.
- `src/components/ui/` — shadcn primitives. **ESLint skips this folder.** Treat it
  as vendored; regenerate rather than hand-edit where you can.

On the Rust side, every new command needs to be added to the `invoke_handler![]`
list in `src-tauri/src/lib.rs`. If the frontend can't see your command, that's
almost always why.

## Style

Prettier handles formatting — single quotes, semicolons, two-space indent, trailing
commas, with `prettier-plugin-tailwindcss` sorting class names. `npm run lint`
cleans up most of it.

A few things the linter enforces that trip people up:

- **`console.log` is an error, not a warning.** Use `src/lib/debugLog.ts`, or the
  `frontend_log` command if it needs to reach the Rust log.
- `any` is a warning. Please don't add new ones.

Beyond that, the main ask is: **write comments that explain _why_.** This codebase
leans on that, especially in the color and layout math, where a magic number
usually has a real reason behind it. If you had to think about something, that
thought is worth a sentence. Match the density of whatever file you're in.

## Working on colors

Colors are token-driven, and the tokens are generated. Please don't hardcode a hex
value in a component — use `bg-background`, `text-muted-foreground`,
`var(--text-dim)`, and so on. A literal color will look right in one mode and wrong
in the other.

If you're adding or changing a palette:

- Themes live in `src/constants/themes.ts` — each has a hand-authored `dark` **and**
  `light` surface set. Light isn't derived from dark. That was tried; it collapsed
  every theme into the same off-white.
- Accents live in `src/constants/accents.ts`, also as explicit dark/light pairs.
- The text ramp is derived, not written by hand. `inkRamp()` in `src/lib/theme.ts`
  pushes each rung through `ensureContrast()` until it clears the floor in
  `FLOORS`, so a new theme needs no ink tuning of its own.
- Terminal palettes are in `src/constants/terminal-schemes.ts` and are mode-aware —
  reach for `termTheme(name, mode)`, never a raw scheme object.

Two rules that will bite you otherwise:

1. `:root` in `src/index.css` has to match what `themeTokens()` emits for Carbon in
   dark mode. It's the first-paint fallback, and drift shows up as a color flash on
   the boot splash.
2. `--accent` must never equal `--popover`. They were identical once, which made
   dropdown hover states completely invisible.

Check contrast with numbers rather than trusting your eyes — a ratio that looks fine
on your monitor can fail on someone else's.

## Security

Secrets go to the OS keychain (`src-tauri/src/vault.rs`) and nowhere else. Never
write a password, passphrase, or private key to SQLite, to a file, or to a log line
— not even temporarily while debugging.

Found a vulnerability? Please don't open a public issue. Contact the maintainer
directly through GitHub so it can be fixed before it's described in public.

## Commits and PRs

Commit messages follow Conventional Commits loosely — `feat:`, `fix:`, `refactor:`,
`chore:`. It's not enforced, and nobody will reject a PR over it.

For the PR itself: describe what changed and why, and mention anything you
deliberately left out. Small, focused PRs get reviewed fastest. If a change grew
into three unrelated things, splitting it up is usually worth the few extra minutes.

## Licensing

TerCTL is [MIT licensed](LICENSE). By opening a pull request, you're agreeing that
your contribution ships under the same terms. There's no CLA to sign.

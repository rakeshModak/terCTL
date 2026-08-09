<div align="center">

<img src="src-tauri/icons/128x128.png" width="96" alt="TerCTL" />

# TerCTL

### Your servers, one keystroke away.

A keyboard-first **SSH client and terminal manager** for macOS, Windows, and Linux.<br/>
Terminals, split-pane Decks, SFTP, and live host metrics in one native app.

<br/>

![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?style=for-the-badge&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-stable-000000?style=for-the-badge&logo=rust&logoColor=white)

![macOS](https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat&logo=windows&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat&logo=linux&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat)

</div>

<br/>

TerCTL keeps a fleet of machines within reach: organize hosts into groups, open
secure terminals, split them into workspaces, move files over SFTP, and watch a
server's vitals — without reaching for the mouse.

It's a real desktop app, not a browser wrapper. SSH, PTYs, SFTP, and keychain
access all run in Rust; the UI is React on top of Tauri.

<div align="center">
  <em>📸 Screenshots coming soon</em>
</div>

---

## Features

|                           |                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 🖥️ **SSH terminals**      | Real PTY sessions over `russh`, rendered with [xterm.js](https://xtermjs.org), with per-host color schemes. |
| 🪟 **Decks**              | Split a tab into panes. Drag a pane to re-split, drag a divider to resize — every session stays live.       |
| 🔍 **In-terminal search** | Find across scrollback with case and regex toggles, and jump between matches.                               |
| 🗂️ **Host management**    | Nested groups, tags, and search across labels, hostnames, users, and tags.                                  |
| 📁 **SFTP transfer**      | Dual-pane local ⇄ remote browser: upload, download, rename, new folder, hidden-file toggle.                 |
| 📊 **Live metrics**       | CPU and core count, load average, memory, disk, network throughput, uptime, top processes.                  |
| ⚡ **Local shells**       | Open a local terminal alongside the remote ones.                                                            |
| 🔐 **Keychain-backed**    | Passwords, passphrases, and private keys go to the OS keychain — never to disk or the database.             |
| 💾 **Config backup**      | Export and import your setup as an encrypted file (Argon2id + XChaCha20-Poly1305).                          |
| 🎨 **Themeable**          | Ten themes with hand-tuned light and dark palettes, sixteen accents, nine terminal schemes.                 |
| 🔄 **Auto-update**        | Signed updates delivered straight from GitHub Releases.                                                     |

---

## Tech stack

<table>
<tr>
<td valign="top" width="50%">

**Frontend**

![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite_8-646CFF?logo=vite&logoColor=white)
![TanStack Router](https://img.shields.io/badge/TanStack_Router-FF4154?logo=react-query&logoColor=white)
![Jotai](https://img.shields.io/badge/Jotai-000000)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)
![xterm.js](https://img.shields.io/badge/xterm.js-3A3A3A)

</td>
<td valign="top" width="50%">

**Backend** · Rust (Tauri 2)

![russh](https://img.shields.io/badge/russh-SSH-DEA584)
![sftp](https://img.shields.io/badge/russh--sftp-SFTP-DEA584)
![pty](https://img.shields.io/badge/portable--pty-PTY-DEA584)
![keyring](https://img.shields.io/badge/keyring-Keychain-DEA584)
![sqlite](https://img.shields.io/badge/rusqlite-SQLite-003B57?logo=sqlite&logoColor=white)

</td>
</tr>
</table>

---

## Getting started

### Prerequisites

- **Node 22** — pinned in `.node-version`, so [fnm](https://github.com/Schniz/fnm)
  or nvm will pick it up on their own.
- **Rust** (stable) — [rustup.rs](https://rustup.rs)
- **Platform toolchain** — follow Tauri's
  [prerequisites](https://tauri.app/start/prerequisites/) for your OS. On Debian and
  Ubuntu that means WebKitGTK and a few build packages; the exact list is in
  [`.github/workflows/release.yml`](.github/workflows/release.yml).

### Run it

```bash
npm install
npm run tauri dev
```

On Linux, if the window fails to start, try `npm run tauri:dev` instead — it clears
a `GTK_PATH` that some distros set and WebKit doesn't like.

### Build an installer

```bash
npm run tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

---

## How it fits together

The frontend flows one way, top to bottom:

```
 routes  ──▶  modules  ──▶  services  ──▶  Tauri IPC  ──▶  Rust backend
(routing)   (features)    (typed API)     (invoke)      (SSH · PTY · SFTP)
```

Everything that touches the network, the filesystem, or the OS keychain happens in
Rust. The React side never opens a socket.

```
src/
├── routes/       # file-based routes ( / · hosts · sessions · transfer · settings )
├── modules/      # one folder per feature (hosts · sessions · transfer · settings · layout)
├── store/        # Jotai atoms (app · settings · dialog · updater · version)
├── services/     # typed Tauri IPC clients — the only place invoke() is called
├── types/        # shared domain types
├── hooks/        # cross-feature React hooks
├── components/   # shared UI, window chrome, and shadcn primitives in ui/
├── lib/          # color math · layout math · platform detection · helpers
├── constants/    # accents · themes · terminal color schemes
└── styles/       # theme.css — tokens, keyframes, base resets

src-tauri/src/
├── commands.rs   # hosts, groups, credentials
├── ssh.rs        # SSH connect + auth
├── local_term.rs # local shell sessions
├── session.rs    # PTY input, resize, teardown
├── sftp.rs       # remote and local file operations
├── metrics.rs    # live host stats
├── backup.rs     # encrypted config export/import
├── store.rs      # SQLite (hosts, groups, known-host keys)
└── vault.rs      # OS keychain access
```

### Where your data goes

Hosts, groups, tags, and known-host fingerprints sit in a SQLite file in the app
data directory. Secrets never join them — passwords, passphrases, and private keys
go to the macOS Keychain, Windows Credential Manager, or the Secret Service on
Linux. Config exports are encrypted with Argon2id and XChaCha20-Poly1305.

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup,
conventions, and what makes a change easy to review.

---

## Releases

Pushing a `v*` tag builds installers for all three platforms and publishes them:

```bash
npm run release          # patch — also try release:minor / release:major
```

The script builds first, bumps the version, tags, and pushes. CI takes it from
there: three OS runners upload into a draft release, and it only goes public once
all three finish.

---

## Roadmap

- [ ] **Port forwarding** — local and remote tunnels
- [ ] **Command palette** (`⌘K` / `Ctrl K`)
- [ ] **SSH key management** — generate, import, and manage the agent
- [ ] Native window controls on Windows and Linux
- [ ] Screenshots and a proper landing page

---

## License

[MIT](LICENSE) — use it, fork it, ship it. Just keep the copyright notice.

---

<div align="center">

Built with 🦀 Rust and ⚛️ React, wrapped in [Tauri](https://tauri.app).

<sub>© TerCTL</sub>

</div>

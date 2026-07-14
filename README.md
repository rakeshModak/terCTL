<div align="center">

<img src="src-tauri/icons/128x128.png" width="96" alt="TerCTL" />

# TerCTL

### Your servers, one keystroke away.

A fast, keyboard-first **SSH client & terminal manager** for macOS, Windows, and Linux.<br/>
Terminals, split-pane Decks, SFTP, and live host metrics — in one native, buttery app.

<br/>

![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?style=for-the-badge&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-stable-000000?style=for-the-badge&logo=rust&logoColor=white)

![macOS](https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat&logo=windows&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat&logo=linux&logoColor=black)
![License](https://img.shields.io/badge/license-TBD-lightgrey?style=flat)

</div>

<br/>

> [!NOTE]
> **TerCTL** keeps your fleet a single keystroke away — organize hosts, open secure terminals,
> split them into workspaces, browse files over SFTP, and watch a server's vitals in real time,
> without leaving the keyboard.

<br/>

<!-- Replace with a real screenshot / GIF once hosted -->
<div align="center">
  <em>📸 Screenshots coming soon</em>
</div>

---

## ✨ Features

| | |
|---|---|
| 🖥️ **SSH Terminals** | Real PTY sessions over `russh` with full [xterm.js](https://xtermjs.org) rendering and per-host color schemes. |
| 🪟 **Decks** | Split a tab into multiple panes — drag panes to re-split, drag dividers to resize, all sessions stay live. |
| 🗂️ **Host Management** | Nested groups, tags, and instant search across labels, hostnames, users, and tags. |
| 📁 **SFTP Transfer** | Dual-pane local ⇄ remote browser: upload, download, rename, new folder, hidden-file toggle. |
| 📊 **Live Metrics** | CPU + core count, load average, memory, disk, network throughput, uptime, and top processes. |
| ⚡ **Local Shells** | Spin up a local terminal right beside your remote sessions. |
| 🔐 **Secure by Default** | Passwords & key passphrases live in the **OS keychain** — never written to disk. |
| 🎨 **Themeable** | Multiple base themes, accent colors, and terminal color schemes. |
| 🌍 **Cross-platform** | One codebase → native installers for macOS, Windows, and Linux. |

---

## 🧰 Tech Stack

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

## 🚀 Getting Started

### Prerequisites
- **Node 22+** — a `.node-version` is pinned; [fnm](https://github.com/Schniz/fnm) / nvm pick it up automatically.
- **Rust** (stable) — [rustup.rs](https://rustup.rs)
- Tauri platform toolchains — [prerequisites](https://tauri.app/start/prerequisites/).

### Run it

```bash
npm install
npm run tauri dev      # 🔥 app with hot-reload
```

### Ship it

```bash
npm run tauri build    # 📦 native installer for the current OS
```

---

## 🏗️ Architecture

The frontend follows the **CalmUI** layout — a clean one-way flow:

```
 routes  ──▶  modules  ──▶  services  ──▶  Tauri IPC  ──▶  Rust backend
(routing)   (features)    (typed API)     (invoke)      (SSH · PTY · SFTP)
```

```
src/
├── routes/       # TanStack file-based routes ( / · hosts · sessions · transfer · keys · settings )
├── modules/      # one folder per feature   (hosts · sessions · transfer · settings · keys)
├── store/        # Jotai atoms              (app · settings · dialog)
├── services/     # typed Tauri IPC clients  (hosts · ssh · sftp · metrics · credentials)
├── models/       # shared domain types
├── components/   # shared UI + window chrome (title bar · activity rail · dialogs)
├── lib/          # layout math · platform detection · helpers
├── constants/    # accents · themes · terminal color schemes
└── styles/       # theme.css — design tokens, keyframes, base resets

src-tauri/        # Rust backend — SSH, SFTP, PTY, metrics, keychain, SQLite
```

---

## 📦 Releases

Push a `v*` tag → GitHub Actions builds & publishes installers for **all three platforms**:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 🗺️ Roadmap

- [ ] **Keys & Identity** — manage SSH keys and the agent (currently a preview)
- [ ] **Port forwarding** — local / remote tunnels
- [ ] **Command palette** (`⌘K` / `Ctrl K`)
- [ ] Native window controls on Windows & Linux
- [ ] Auto-update

---

<div align="center">

Built with 🦀 Rust + ⚛️ React, wrapped in [Tauri](https://tauri.app).

<sub>© TerCTL</sub>

</div>

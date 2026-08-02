# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ultra is an Electron desktop app — an "agentic terminal": a real terminal (`xterm.js` + `node-pty`)
flanked by resizable sidebars for projects/sessions, a file tree, git, and pinned context. Agent
CLIs (`claude`, `codex`, or any custom command) are launched as ordinary child processes in a PTY
scoped to the project directory — Ultra does not reimplement an agent loop, it's a harness around
whatever CLI the user runs.

Stack: Electron · React 18 · TypeScript · Vite (`electron-vite`) · Tailwind + shadcn/ui (Radix) ·
Zustand · `@xterm/xterm` · `node-pty`.

## Commands

```bash
npm install         # also rebuilds node-pty against Electron's ABI (postinstall)
npm run dev          # electron-vite dev, hot-reload
npm run build         # bundle main/preload/renderer (electron-vite build)
npm run typecheck      # tsc --noEmit across the node project + the web project
npm run test          # vitest run (single run)
npm run test:watch      # vitest watch mode
npm run dist:mac       # build + electron-builder --mac -> .app/.dmg/.zip under release/
```

Run a single test file: `npx vitest run test/git-service.test.ts`.
Tests live in `test/*.test.ts` (not colocated with source) and run under Vitest's `node`
environment; `test/electron-stub.ts` is aliased in place of the real `electron` module (see
`vitest.config.ts`) so main-process modules that `import { app } from 'electron'` are testable
without a real Electron runtime.

There is no lint script — `npm run typecheck` is the only static check.

## Process architecture

Three separate TypeScript projects, each with its own tsconfig, compiled by `electron-vite`:

- **`src/main`** (`tsconfig.node.json`) — the Electron main process. Owns everything privileged:
  PTY lifecycle (`pty.ts`), filesystem access + `chokidar` watching (`fs-service.ts`), git (shells
  out to the system `git` binary, `git-service.ts`), agent binary detection (`agents.ts`), editor
  launching (`editor.ts`), workspace persistence to `userData/projects.json` (`store.ts`), and
  `index.ts` which wires up the `BrowserWindow`, app menu, Dock/Tray icon state, and every
  `ipcMain` handler.
- **`src/preload`** (also under `tsconfig.node.json`) — `index.ts` defines a single typed `api`
  object exposed via `contextBridge.exposeInMainWorld('api', api)`; `index.d.ts` declares
  `window.api` for the renderer. `contextIsolation` is on, `nodeIntegration` is off, and the
  renderer is otherwise sandboxed — **all fs/child_process/git access must go through this typed
  IPC bridge**, never added directly to the renderer.
- **`src/renderer`** (`tsconfig.web.json`) — the React UI, path-aliased as `@/*`. State lives in a
  single Zustand store (`store/useStore.ts`), persisted through `window.api.store.load/save` to
  the same `projects.json` main-process file (metadata only — no live PTYs or scrollback are
  persisted).

When adding a capability that needs Node/OS access: add the implementation in `src/main`, register
an `ipcMain.handle`/`ipcMain.on` for it in `registerIpc()` (`src/main/index.ts`), expose it on the
`api` object in `src/preload/index.ts`, then call `window.api.<...>` from the renderer.

## Renderer structure

- **`components/panelRegistry.tsx`** is the single source of truth for sidebar panels: each
  `SidebarBlockKey` (git, files, editor, context, terminal, shells, ports, processes, resources,
  tasks) maps to a label/icon/size hints/render fn. Both sidebars pull from this registry, so a
  panel can be dragged into either sidebar without duplicated wiring. Terminal split panes are a
  separate dynamic `PanelKey` variant (`isSplitPanel`/`splitPaneId`), handled alongside the static
  registry in `panelMeta()`.
- **`components/panelDnd.ts`** — drag-and-drop logic for rearranging panels between sidebars.
  Layout itself uses `react-resizable-panels` (see `PanelColumn.tsx`).
  - A **project** is a working directory + config; a **session** is a PTY (+ optional agent CLI)
  scoped to a project. Both are modeled in `store/useStore.ts`.
- Terminals persist across tab switches — PTYs are kept alive in the main process and the
  `xterm.js` instance/scrollback is kept mounted rather than torn down on tab switch
  (`PersistentSplitTerminals.tsx`, `TerminalPane.tsx`, `SplitTerminalPanel.tsx`).
- Agent CLIs are launched via a login shell (`zsh -l -c "exec <command>"`) so they inherit the
  user's PATH/env and get a real TTY for their own TUI; Ultra detects availability by probing the
  binary with `which` (`agent:probe` IPC → `src/main/agents.ts`).
- The macOS Dock icon and menu-bar Tray "agent working" animation are driven from the main process
  (`src/main/index.ts`), not the renderer, because Chromium throttles/freezes renderer timers when
  the window is hidden — precisely when the tray indicator needs to keep animating.

## macOS signing, notarization, and releases

See `AGENTS.md` for the full runbook (identities, `electron-builder.yml` config, notarytool
commands, unsigned local builds, and the exact "push and release" flow) — read it before doing any
signing, notarizing, or release work. Key points to know up front:

- Packaged builds must never open DevTools; `!app.isPackaged` gates it in `src/main/index.ts`.
- The macOS build is signed + notarized + stapled for zero Gatekeeper prompts. Prefer App Store
  Connect API-key env vars (`NOTARY_API_KEY`, `NOTARY_API_KEY_ID`, `NOTARY_API_ISSUER`) for
  notarization; the `ultra-notary` keychain profile is the fallback.
- Releases are published to GitHub (`petit-software/ultra`) as tag `v<version>`, and must include
  the DMG, the zip, and `release/latest-mac.yml` — `electron-updater` reads the manifest from the
  latest release and installs from the zip, so a release without the zip breaks auto-update for
  existing installs. Versions must never be reused or decreased.

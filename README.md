# Ultra

An **agentic terminal** — a desktop app that wraps a real terminal with an
embedded coding-agent workflow. Run your agent CLI of choice (Claude Code,
Codex, …) in a project-scoped terminal, browse and pin files as context, and
manage git — all from one window.

> Electron · xterm.js · React · TypeScript · Tailwind + shadcn/ui

## Features

- **Real terminal** — `xterm.js` + `node-pty`, one live PTY per session, kept
  alive across tab switches.
- **Bring-your-own agent** — launch any agent CLI (`claude`, `codex`, or a custom
  command) from the header; each runs in a PTY scoped to the active project, with
  live availability detection.
- **Projects & sessions** — open folders as projects, multiple shells/agents per
  project, all persisted.
- **File tree** — live, watched, lazy-loaded; click to preview, send a file to the
  agent as an `@mention`, open in Finder, edit in your editor, or trash it.
- **Context** — pin files or whole folders (folders expand to their files) and
  send them to the active agent terminal as `@mentions`.
- **Git** — a Source Control panel: init, stage/unstage/discard, commit, branch
  switch/create, fetch/pull/push, per-file diffs, and history.
- **Editor integration** — open files in VS Code (default) or any configured
  editor command.
- **Theming** — pure-black Hyper-style dark mode and a light mode; floating-card
  layout with adjustable, detached sidebar sections.

## Layout

```
┌──────────────┬────────────────────────┬──────────────┐
│ Projects     │                        │  Files       │
│ ──────────   │   xterm.js terminal    │  ──────────  │
│ Source       │   (+ agent CLI)        │  Context     │
│ Control      │                        │              │
└──────────────┴────────────────────────┴──────────────┘
```

## Development

```bash
npm install       # also rebuilds node-pty against Electron's ABI
npm run dev       # launch with hot-reload
npm run typecheck # tsc across main, preload, renderer
npm run build     # bundle main/preload/renderer
```

## Packaging (macOS)

```bash
npm run dist:mac  # produces a .app, DMG, and zip under release/
```

## Architecture

- **main** — Electron main process: PTY management, filesystem service (+ chokidar
  watch), git service (shells out to system `git`), agent/editor launchers. All
  privileged work lives here.
- **preload** — a typed, minimal `window.api` bridge (contextIsolation on).
- **renderer** — React UI; Zustand store persisted to `userData/projects.json`.

Agents are external CLIs launched via a login shell so they inherit your PATH,
credentials, and a real TTY — Ultra is the harness around them, not a
reimplementation of any agent.

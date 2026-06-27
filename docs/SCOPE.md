# Ultra — Agentic Terminal

An Electron desktop app: a real terminal (xterm.js) with an embedded AI agent,
flanked by two sidebars — **Projects/Sessions** on the left and a **File tree +
uploaded context** on the right.

## Layout

```
┌──────────┬─────────────────────────────┬──────────────┐
│ LEFT     │        CENTER               │  RIGHT       │
│ Sidebar1 │   xterm.js terminal         │  Sidebar 2   │
│ PROJECTS │   + agent chat / stream     │  FILE TREE   │
│ /sessions│                             │  + uploaded  │
│          │                             │  context     │
└──────────┴─────────────────────────────┴──────────────┘
```

## Tech stack

- **Shell:** Electron (Node available in main: node-pty, fs, agent loop).
- **UI:** React + Vite + TypeScript, via electron-vite (HMR).
- **Terminal:** `@xterm/xterm` + addons `addon-fit`, `addon-search`, `addon-web-links`.
- **PTY:** `node-pty` (spawns the real shell in the main process).
- **State:** Zustand.
- **Layout:** `react-resizable-panels` (3 resizable columns).
- **Agent:** `@anthropic-ai/sdk` running the loop in the main process. Default to
  the latest Claude model (Opus 4.8 / Sonnet 4.6); confirm IDs before wiring.

## Process architecture

```
MAIN (Node)                          RENDERER (React)
├─ PTY manager (node-pty)    ◄──IPC──► Terminal pane (xterm.js)
├─ Agent loop (Anthropic SDK)◄──IPC──► Agent panel (chat/stream)
├─ FS service (read tree,    ◄──IPC──► File tree + context panel
│   watch, read files)
├─ Tool executor (run cmds,
│   edit files) + approvals
└─ Project/session store (disk)
```

- IPC via `preload.ts` exposing a typed, minimal `window.api`.
- contextIsolation ON, nodeIntegration OFF, sandboxed renderer.
- No raw fs/child_process in the renderer — everything funnels through typed IPC.

## Feature areas

### A. Terminal (center)
- One xterm instance per session, fed by one node-pty per session.
- FitAddon on resize; persist scrollback per session.

### B. Projects / sessions sidebar (left)
- A **project** = a working directory + config. A **session** = a PTY + an agent
  conversation scoped to that project.
- List projects → expand to sessions → click to focus. New/close/rename.
- Persist to `app.getPath('userData')/projects.json`.

### C. File tree + uploaded context (right)
- FS service walks the project dir (respect `.gitignore`, cap depth, lazy-load),
  watches with `chokidar` for live updates.
- **Uploaded context** = files dragged/pinned; stored as references the agent may
  read. Show a token-count estimate per pinned file.

### D. Agentic layer
- Loop in main: user message → Claude with tool definitions → tool calls →
  execute → feed results back → stream text to the agent panel.
- **Tools:** `run_command`, `read_file`, `write_file`/`edit_file`,
  `list_directory`, `search`.
- **Approvals:** every state-changing tool routes through a UI approval before
  executing. Per-session "auto-approve read-only" allowed.
- Stream tokens incrementally; render tool calls as collapsible cards.

## Build order (milestones)

1. **Skeleton** — electron-vite app, 3-pane resizable layout, empty panels.
2. **Live terminal** — xterm + node-pty over IPC, one session, resize works.
3. **Projects/sessions** — multiple PTYs, left sidebar switches, persisted.
4. **File tree** — right panel reads + watches project dir; click-to-preview.
5. **Agent loop (read-only)** — chat panel, Claude streaming, read-only tools.
6. **Mutating tools + approvals** — `run_command`, `write/edit_file` behind gate.
7. **Uploaded/pinned context** — drag-in files, token estimates, pass to agent.
8. **Polish** — themes, keybindings, settings, scrollback/history persistence.

## Risks to design around

- **Trust boundary:** never expose fs/exec to the renderer — typed IPC only.
- **PTY ↔ agent overlap:** agent tool commands run in a separate hidden exec
  (clean capture), mirroring a summary into the visible terminal.
- **Streaming volume:** xterm manages its own canvas (outside React); batch
  agent-panel updates.
- **Secrets:** API key in main only, via OS keychain (`keytar`) or env — never in
  the renderer bundle.

## Status

- [x] M1 Skeleton
- [x] M2 Live terminal
- [ ] M3 Projects/sessions
- [ ] M4 File tree
- [ ] M5 Agent loop (read-only)
- [ ] M6 Mutating tools + approvals
- [ ] M7 Uploaded context
- [ ] M8 Polish

import chokidar, { type FSWatcher } from 'chokidar'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { BrowserWindow } from 'electron'
import { clipSummary, toolSummary } from './summarize'

/**
 * Agent CLIs journal their sessions as JSONL on disk:
 *   - Claude Code: ~/.claude/projects/<munged-cwd>/<session-uuid>.jsonl
 *   - Codex:       ~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-*.jsonl
 *     (project association via the first line's session_meta payload.cwd)
 * This service tails whichever session file for a project directory was
 * written to last — across both agents — and streams parsed chat events to
 * the renderer. The Chat panel renders them as a styled conversation while
 * the PTY terminal stays the interactive surface.
 */

export type TranscriptSource = 'claude' | 'codex'

export interface ChatEvent {
  /** 'mode' events carry the agent's current permission/approval mode. */
  kind: 'user' | 'assistant' | 'tool' | 'mode'
  /** Markdown/plain text for user/assistant; a summary for tools; id for modes. */
  text: string
  /** Tool name, for kind 'tool'. */
  tool?: string
  source: TranscriptSource
  uuid?: string
  ts?: string
}

/** Claude Code's project-directory munging: every non-alphanumeric char → '-'. */
export function mungeCwd(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}

export function claudeTranscriptDirFor(cwd: string): string {
  return path.join(os.homedir(), '.claude', 'projects', mungeCwd(cwd))
}

export function codexSessionsDir(): string {
  return path.join(os.homedir(), '.codex', 'sessions')
}

// Replaying a whole transcript on watch start is capped so a long session
// doesn't flood the renderer; tailed increments are never capped.
const MAX_REPLAY_EVENTS = 300
const MAX_TEXT_LENGTH = 20_000
/** How many leading bytes of a codex rollout can hold its session_meta line. */
const CODEX_META_PROBE_BYTES = 16_384

function clip(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) + ' …' : text
}

/**
 * Parse one Claude Code transcript line into zero or more chat events.
 * Tolerant by design: unknown/meta line types, tool results, and sidechain
 * (subagent) traffic are skipped, and malformed JSON yields nothing.
 */
export function parseClaudeLine(line: string): ChatEvent[] {
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(line) as Record<string, unknown>
  } catch {
    return []
  }
  if (!obj || typeof obj !== 'object') return []
  if (obj.isSidechain === true || obj.isMeta === true) return []
  const source = 'claude' as const

  if (obj.type === 'permission-mode' && typeof obj.permissionMode === 'string') {
    return [{ kind: 'mode', text: obj.permissionMode, source }]
  }
  if (obj.type !== 'user' && obj.type !== 'assistant') return []

  const message = obj.message as { role?: string; content?: unknown } | undefined
  if (!message) return []
  const uuid = typeof obj.uuid === 'string' ? obj.uuid : undefined
  const ts = typeof obj.timestamp === 'string' ? obj.timestamp : undefined

  if (obj.type === 'user') {
    const content = message.content
    // A user line whose content is an array is normally a tool_result carrier,
    // but slash-command style turns can carry text items too.
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
              .filter(
                (c): c is { type: string; text: string } =>
                  !!c && typeof c === 'object' && (c as { type?: string }).type === 'text'
              )
              .map((c) => c.text)
              .join('\n')
          : ''
    // Skip synthetic turns (command echoes, interruption markers, empties).
    if (!text.trim() || text.startsWith('<')) return []
    return [{ kind: 'user', text: clip(text), source, uuid, ts }]
  }

  const content = message.content
  if (!Array.isArray(content)) return []
  const events: ChatEvent[] = []
  for (const item of content) {
    if (!item || typeof item !== 'object') continue
    const it = item as { type?: string; text?: string; name?: string; input?: unknown }
    if (it.type === 'text' && typeof it.text === 'string' && it.text.trim()) {
      events.push({ kind: 'assistant', text: clip(it.text), source, uuid, ts })
    } else if (it.type === 'tool_use' && typeof it.name === 'string') {
      events.push({ kind: 'tool', tool: it.name, text: toolSummary(it.input), source, uuid, ts })
    }
  }
  return events
}

/** Best-effort `cmd` extraction from codex's exec tool-call code strings. */
function codexExecSummary(input: string): string {
  const m = input.match(/"cmd":"((?:[^"\\]|\\.)*)"/)
  if (m) {
    try {
      return clipSummary(JSON.parse(`"${m[1]}"`) as string)
    } catch {
      /* fall through to the raw clip */
    }
  }
  return clipSummary(input)
}

/** Codex sandbox policy → the approval-preset id shown in its TUI. */
function codexModeOf(payload: Record<string, unknown>): string | null {
  const sandbox = payload.sandbox_policy as { type?: string } | undefined
  switch (sandbox?.type) {
    case 'read-only':
      return 'read-only'
    case 'workspace-write':
      return 'auto'
    case 'danger-full-access':
      return 'full-access'
    default:
      return null
  }
}

/**
 * Parse one Codex rollout line into zero or more chat events. Chat text comes
 * from event_msg user/agent messages; tool rows from response_item calls; the
 * approval mode from turn_context. Everything else (reasoning, outputs, token
 * counts, meta) is skipped.
 */
export function parseCodexLine(line: string): ChatEvent[] {
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(line) as Record<string, unknown>
  } catch {
    return []
  }
  if (!obj || typeof obj !== 'object') return []
  const payload = obj.payload as Record<string, unknown> | undefined
  if (!payload || typeof payload !== 'object') return []
  const source = 'codex' as const
  const ts = typeof obj.timestamp === 'string' ? obj.timestamp : undefined

  if (obj.type === 'turn_context') {
    const mode = codexModeOf(payload)
    return mode ? [{ kind: 'mode', text: mode, source, ts }] : []
  }

  if (obj.type === 'event_msg') {
    const message = typeof payload.message === 'string' ? payload.message : ''
    if (!message.trim()) return []
    if (payload.type === 'user_message') return [{ kind: 'user', text: clip(message), source, ts }]
    if (payload.type === 'agent_message')
      return [{ kind: 'assistant', text: clip(message), source, ts }]
    return []
  }

  if (obj.type === 'response_item') {
    const name = typeof payload.name === 'string' ? payload.name : ''
    if (payload.type === 'custom_tool_call' && name) {
      const input = typeof payload.input === 'string' ? payload.input : ''
      return [{ kind: 'tool', tool: name, text: codexExecSummary(input), source, ts }]
    }
    if (payload.type === 'function_call' && name) {
      let args: unknown = null
      try {
        args = JSON.parse(typeof payload.arguments === 'string' ? payload.arguments : '')
      } catch {
        /* unparseable arguments — no summary */
      }
      return [{ kind: 'tool', tool: name, text: toolSummary(args), source, ts }]
    }
  }
  return []
}

const PARSERS: Record<TranscriptSource, (line: string) => ChatEvent[]> = {
  claude: parseClaudeLine,
  codex: parseCodexLine
}

interface TranscriptWatch {
  watchers: FSWatcher[]
  win: BrowserWindow
  cwd: string
  /** The transcript file currently being tailed (newest across both agents). */
  activeFile: string | null
  activeSource: TranscriptSource
  activeMtime: number
  offset: number
  /** Partial trailing line carried over between reads. */
  remainder: string
  reading: boolean
  pendingRead: boolean
  /** rollout file → its session_meta cwd (null = read failed / no meta). */
  codexCwd: Map<string, string | null>
  /**
   * When set, only session files of this source born at/after `since` are
   * followed — the chat panel pins the mirror to the agent it just started,
   * so an older busy session elsewhere can't win the newest-file race.
   */
  follow: { source: TranscriptSource; since: number } | null
}

/** Slack for follow-mode birth-time comparison (clock skew, spawn delay). */
const FOLLOW_SINCE_SLACK_MS = 10_000

const watches = new Map<string, TranscriptWatch>()

/** Read a codex rollout's session_meta cwd from its first line. */
async function codexFileCwd(file: string): Promise<string | null> {
  try {
    const fh = await fs.open(file, 'r')
    try {
      const buf = Buffer.alloc(CODEX_META_PROBE_BYTES)
      const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
      const firstLine = buf.toString('utf8', 0, bytesRead).split('\n')[0]
      const obj = JSON.parse(firstLine) as { type?: string; payload?: { cwd?: unknown } }
      return obj.type === 'session_meta' && typeof obj.payload?.cwd === 'string'
        ? obj.payload.cwd
        : null
    } finally {
      await fh.close()
    }
  } catch {
    return null
  }
}

/** Tail the newest agent transcript for a project cwd; push events to `win`. */
export function watchTranscripts(win: BrowserWindow, cwd: string): void {
  if (watches.has(cwd)) return
  const w: TranscriptWatch = {
    watchers: [],
    win,
    cwd,
    activeFile: null,
    activeSource: 'claude',
    activeMtime: 0,
    offset: 0,
    remainder: '',
    reading: false,
    pendingRead: false,
    codexCwd: new Map(),
    follow: null
  }
  watches.set(cwd, w)

  const activate = (
    file: string,
    source: TranscriptSource,
    mtime: number,
    birth: number
  ): void => {
    if (w.follow) {
      if (source !== w.follow.source) return
      // Prefer birth time; fall back to mtime when the fs doesn't track it.
      const born = birth > 0 ? birth : mtime
      if (born < w.follow.since - FOLLOW_SINCE_SLACK_MS) return
    }
    if (w.activeFile !== file) {
      // Follow whichever session file was written to last — a newer session
      // (a resumed one, or the other agent's) takes over the panel.
      if (w.activeFile !== null && mtime <= w.activeMtime) return
      w.activeFile = file
      w.activeSource = source
      w.activeMtime = mtime
      w.offset = 0
      w.remainder = ''
      send(w, 'transcript:reset', { cwd })
    } else {
      w.activeMtime = Math.max(w.activeMtime, mtime)
    }
    void readMore(w)
  }

  const claudeWatcher = chokidar.watch(claudeTranscriptDirFor(cwd), {
    ignoreInitial: false,
    alwaysStat: true,
    depth: 0,
    persistent: true
  })
  const onClaudeFile = (file: string, stats?: { mtimeMs?: number; birthtimeMs?: number }): void => {
    if (file.endsWith('.jsonl'))
      activate(file, 'claude', stats?.mtimeMs ?? Date.now(), stats?.birthtimeMs ?? 0)
  }
  claudeWatcher.on('add', onClaudeFile).on('change', onClaudeFile)

  // Codex journals all projects into one dated tree; project association only
  // lives inside each file's first line, probed once and cached per file.
  const codexWatcher = chokidar.watch(codexSessionsDir(), {
    ignoreInitial: false,
    alwaysStat: true,
    depth: 4,
    persistent: true
  })
  const onCodexFile = (file: string, stats?: { mtimeMs?: number; birthtimeMs?: number }): void => {
    if (!path.basename(file).startsWith('rollout-') || !file.endsWith('.jsonl')) return
    const mtime = stats?.mtimeMs ?? Date.now()
    const birth = stats?.birthtimeMs ?? 0
    const known = w.codexCwd.get(file)
    if (known !== undefined) {
      if (known === w.cwd) activate(file, 'codex', mtime, birth)
      return
    }
    void codexFileCwd(file).then((fileCwd) => {
      if (!watches.has(w.cwd)) return // unwatched while probing
      w.codexCwd.set(file, fileCwd)
      if (fileCwd === w.cwd) activate(file, 'codex', mtime, birth)
    })
  }
  codexWatcher.on('add', onCodexFile).on('change', onCodexFile)

  w.watchers = [claudeWatcher, codexWatcher]
}

function send(w: TranscriptWatch, channel: string, payload: unknown): void {
  if (!w.win.isDestroyed()) w.win.webContents.send(channel, payload)
}

/** Read newly appended bytes from the active file; serialized per watch. */
async function readMore(w: TranscriptWatch): Promise<void> {
  if (w.reading) {
    w.pendingRead = true
    return
  }
  w.reading = true
  try {
    do {
      w.pendingRead = false
      const file = w.activeFile
      if (!file) break
      const parse = PARSERS[w.activeSource]
      const replay = w.offset === 0
      let chunk: string
      try {
        const fh = await fs.open(file, 'r')
        try {
          const stat = await fh.stat()
          if (stat.size < w.offset) {
            // Truncated/rewritten (e.g. compaction) — start over.
            w.offset = 0
            w.remainder = ''
            send(w, 'transcript:reset', { cwd: w.cwd })
          }
          if (stat.size === w.offset) continue
          const len = stat.size - w.offset
          const buf = Buffer.alloc(len)
          await fh.read(buf, 0, len, w.offset)
          w.offset = stat.size
          chunk = buf.toString('utf8')
        } finally {
          await fh.close()
        }
      } catch {
        continue // file vanished mid-read; the next event re-syncs
      }
      const lines = (w.remainder + chunk).split('\n')
      w.remainder = lines.pop() ?? ''
      let events: ChatEvent[] = []
      for (const line of lines) if (line.trim()) events.push(...parse(line))
      if (replay && events.length > MAX_REPLAY_EVENTS) events = events.slice(-MAX_REPLAY_EVENTS)
      if (events.length) send(w, 'transcript:events', { cwd: w.cwd, events })
    } while (w.pendingRead)
  } finally {
    w.reading = false
  }
}

/**
 * Pin (or unpin) the mirror for a cwd to session files of one agent born
 * at/after `since`. Pinning blanks the panel until that session's file
 * appears; unpinning reverts to newest-file-wins without a reset.
 */
export function followTranscripts(
  cwd: string,
  source: TranscriptSource | null,
  since: number
): void {
  const w = watches.get(cwd)
  if (!w) return
  if (!source) {
    w.follow = null
    return
  }
  if (w.follow?.source === source && w.follow.since === since) return
  w.follow = { source, since }
  w.activeFile = null
  w.activeMtime = 0
  w.offset = 0
  w.remainder = ''
  send(w, 'transcript:reset', { cwd })
}

export function unwatchTranscripts(cwd: string): void {
  const w = watches.get(cwd)
  if (!w) return
  for (const watcher of w.watchers) void watcher.close()
  watches.delete(cwd)
}

export function unwatchAllTranscripts(): void {
  for (const cwd of [...watches.keys()]) unwatchTranscripts(cwd)
}

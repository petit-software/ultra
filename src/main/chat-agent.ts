import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { readFileSync } from 'fs'
import os from 'os'
import path from 'path'
import { BrowserWindow } from 'electron'
import {
  parseClaudeStreamLine,
  parseCodexExecLine,
  parseCodexModels,
  type ModelOption,
  type ParsedEvent
} from './chat-protocol'

/**
 * Chat sessions for the Chat panel, driven over each agent CLI's structured
 * protocol rather than a puppeteered TUI:
 *
 *   - Claude Code: one long-lived `claude --print … stream-json` process;
 *     messages are written to its stdin as JSON.
 *   - Codex: one `codex exec --json` process per turn, resumed by thread id.
 *
 * Main owns the whole conversation (messages, busy state, queue) so panel
 * remounts, project switches, and renderer reloads can't lose or duplicate
 * anything — the renderer just fetches a snapshot and applies deltas.
 */

export type ChatAgentId = 'claude' | 'codex'
/** One permission level, mapped per agent to its own flag vocabulary. */
export type ChatMode = 'read-only' | 'auto' | 'full-access'

export interface ChatMessage {
  seq: number
  kind: 'user' | 'assistant' | 'tool' | 'error' | 'notice'
  text: string
  tool?: string
}

export interface ChatState {
  agent: ChatAgentId
  mode: ChatMode
  /** The model the user picked, or null for the agent's default. */
  model: string | null
  /** The model the agent reported actually using, when it says. */
  reportedModel: string | null
  /** True while a turn is in flight. */
  busy: boolean
  /** Messages waiting for the current turn to finish. */
  queued: number
  /** Bumped on every change; renderers refetch when they miss one. */
  version: number
  messages: ChatMessage[]
}

const CLAUDE_PERMISSION: Record<ChatMode, string> = {
  'read-only': 'plan',
  auto: 'acceptEdits',
  'full-access': 'bypassPermissions'
}

const CODEX_SANDBOX: Record<ChatMode, string> = {
  'read-only': 'read-only',
  auto: 'workspace-write',
  'full-access': 'danger-full-access'
}

const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'

/** Claude Code takes model aliases; these track its documented shorthands. */
const CLAUDE_MODELS: ModelOption[] = [
  { id: 'fable', label: 'Fable' },
  { id: 'opus', label: 'Opus' },
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'haiku', label: 'Haiku' }
]

/** Shown when the cache can't be read, so the picker is never empty. */
const CODEX_FALLBACK_MODELS: ModelOption[] = [
  { id: 'gpt-5.6-sol', label: 'GPT-5.6-Sol' },
  { id: 'gpt-5.5', label: 'GPT-5.5' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4-Mini' }
]

/** The models available for an agent, read fresh so newly added ones appear. */
export function chatAgentModels(agent: ChatAgentId): ModelOption[] {
  if (agent === 'claude') return CLAUDE_MODELS
  try {
    const cache = readFileSync(
      path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'models_cache.json'),
      'utf8'
    )
    const models = parseCodexModels(JSON.parse(cache))
    return models.length ? models : CODEX_FALLBACK_MODELS
  } catch {
    return CODEX_FALLBACK_MODELS
  }
}

/** How much stderr to keep for the error row when a process fails. */
const STDERR_TAIL = 2000

interface Session {
  win: BrowserWindow
  cwd: string
  agent: ChatAgentId
  mode: ChatMode
  /** Mode picked while a turn was in flight; applied once it finishes. */
  pendingMode: ChatMode | null
  model: string | null
  /** Model picked mid-turn; applied once it finishes. */
  pendingModel: string | null
  reportedModel: string | null
  /** Claude session id / codex thread id, for resuming after a respawn. */
  threadId: string | null
  messages: ChatMessage[]
  version: number
  seq: number
  busy: boolean
  queue: string[]
  child: ChildProcessWithoutNullStreams | null
  stdoutRest: string
  stderrTail: string
  /** Guards against double turn-end (protocol event + process exit). */
  turnClosed: boolean
}

const sessions = new Map<string, Session>()

// ---------------------------------------------------------------------------
// State plumbing
// ---------------------------------------------------------------------------

function snapshot(s: Session): ChatState {
  return {
    agent: s.agent,
    mode: s.mode,
    model: s.model,
    reportedModel: s.reportedModel,
    busy: s.busy,
    queued: s.queue.length,
    version: s.version,
    messages: s.messages
  }
}

function push(s: Session, id: string, rows: Omit<ChatMessage, 'seq'>[]): void {
  const appended = rows.map((row) => ({ ...row, seq: s.seq++ }))
  s.messages.push(...appended)
  s.version++
  if (!s.win.isDestroyed())
    s.win.webContents.send('chatAgent:update', {
      id,
      version: s.version,
      appended,
      agent: s.agent,
      mode: s.mode,
      model: s.model,
      reportedModel: s.reportedModel,
      busy: s.busy,
      queued: s.queue.length
    })
}

/** Notify status-only changes (busy, mode, queue) with no new messages. */
function touch(s: Session, id: string): void {
  push(s, id, [])
}

export function chatAgentState(id: string): ChatState | null {
  const s = sessions.get(id)
  return s ? snapshot(s) : null
}

// ---------------------------------------------------------------------------
// Process lifecycle
// ---------------------------------------------------------------------------

/**
 * Spawn through a login shell so the agent inherits the user's full PATH and
 * env (Ultra launched from the Dock gets only a minimal launchd PATH). Every
 * argument here is static or a UUID — user text always goes over stdin, never
 * through the shell.
 */
function spawnAgent(s: Session, args: string[]): ChildProcessWithoutNullStreams {
  const isWin = os.platform() === 'win32'
  const command = args.join(' ')
  const child = spawn(
    shell,
    isWin ? ['-NoLogo', '-Command', command] : ['-l', '-c', `exec ${command}`],
    { cwd: s.cwd, env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] }
  )
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  return child
}

function claudeArgs(s: Session): string[] {
  const args = [
    'claude',
    '--print',
    '--verbose',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--permission-mode',
    CLAUDE_PERMISSION[s.mode]
  ]
  if (s.model) args.push('--model', s.model)
  if (s.threadId) args.push('--resume', s.threadId)
  return args
}

function codexArgs(s: Session): string[] {
  const args = [
    'codex',
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--sandbox',
    CODEX_SANDBOX[s.mode]
  ]
  if (s.model) args.push('--model', s.model)
  // Flags must precede the `resume` subcommand; the prompt arrives as stdin.
  if (s.threadId) args.push('resume', s.threadId)
  args.push('-')
  return args
}

/** Feed parsed protocol events into the session's state. */
function applyEvents(s: Session, id: string, events: ParsedEvent[]): void {
  const rows: Omit<ChatMessage, 'seq'>[] = []
  let ended = false
  for (const ev of events) {
    if (ev.kind === 'session') {
      s.threadId = ev.text
    } else if (ev.kind === 'model') {
      s.reportedModel = ev.text
    } else if (ev.kind === 'turn-end') {
      ended = true
    } else {
      rows.push({ kind: ev.kind, text: ev.text, tool: ev.tool })
    }
  }
  if (rows.length) push(s, id, rows)
  if (ended) endTurn(s, id)
}

function wire(s: Session, id: string, child: ChildProcessWithoutNullStreams): void {
  const parse = s.agent === 'claude' ? parseClaudeStreamLine : parseCodexExecLine
  s.stdoutRest = ''
  s.stderrTail = ''

  child.stdout.on('data', (chunk: string) => {
    if (s.child !== child) return // superseded by a respawn
    const lines = (s.stdoutRest + chunk).split('\n')
    s.stdoutRest = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      applyEvents(s, id, parse(line))
    }
  })
  child.stderr.on('data', (chunk: string) => {
    s.stderrTail = (s.stderrTail + chunk).slice(-STDERR_TAIL)
  })
  child.on('error', (err) => {
    if (s.child !== child) return
    s.child = null
    push(s, id, [{ kind: 'error', text: `Could not start ${s.agent}: ${err.message}` }])
    endTurn(s, id)
  })
  child.on('exit', (code) => {
    if (s.child !== child) return
    s.child = null
    // Agents log warnings to stderr even on success, so only a failing exit
    // code turns stderr into a visible error.
    if (code !== 0 && code !== null) {
      const detail = s.stderrTail.trim().split('\n').slice(-3).join('\n').slice(-400)
      push(s, id, [
        {
          kind: 'error',
          text: detail
            ? `${s.agent} exited with code ${code}.\n${detail}`
            : `${s.agent} exited with code ${code}.`
        }
      ])
    } else if (s.busy && !s.turnClosed && s.agent === 'claude') {
      push(s, id, [{ kind: 'notice', text: 'Claude session ended; it will restart on your next message.' }])
    }
    // A codex turn is one process, so its exit always ends the turn; a claude
    // process exiting mid-turn ends it too (a new one starts on next send).
    endTurn(s, id)
  })
}

/** Ensure a live claude process, resuming the conversation if one existed. */
function ensureClaude(s: Session, id: string): void {
  if (s.child) return
  s.turnClosed = false
  const child = spawnAgent(s, claudeArgs(s))
  s.child = child
  wire(s, id, child)
}

function startCodexTurn(s: Session, id: string, text: string): void {
  s.turnClosed = false
  const child = spawnAgent(s, codexArgs(s))
  s.child = child
  wire(s, id, child)
  child.stdin.on('error', () => {
    /* the exit handler reports the failure */
  })
  child.stdin.end(text)
}

function endTurn(s: Session, id: string): void {
  if (s.turnClosed && !s.busy) return
  s.turnClosed = true
  s.busy = false
  if (s.pendingMode || s.pendingModel) {
    const mode = s.pendingMode ?? s.mode
    const model = s.pendingModel !== null ? s.pendingModel : s.model
    s.pendingMode = null
    s.pendingModel = null
    respawnWith(s, id, mode, model)
  }
  const next = s.queue.shift()
  if (next !== undefined) startTurn(s, id, next)
  else touch(s, id)
}

function startTurn(s: Session, id: string, text: string): void {
  s.busy = true
  s.turnClosed = false
  if (s.agent === 'claude') {
    ensureClaude(s, id)
    const message = {
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text }] }
    }
    try {
      s.child?.stdin.write(JSON.stringify(message) + '\n')
    } catch {
      push(s, id, [{ kind: 'error', text: 'Could not reach Claude — the session was restarted.' }])
      s.child = null
      s.busy = false
    }
  } else {
    startCodexTurn(s, id, text)
  }
  touch(s, id)
}

/**
 * Apply a mode/model change. Both are launch flags, so claude's long-lived
 * process is retired here; the next send respawns it with --resume, keeping
 * the conversation. A codex turn is its own process, so it just picks the new
 * flags up next time.
 */
function respawnWith(s: Session, id: string, mode: ChatMode, model: string | null): void {
  s.mode = mode
  s.model = model
  if (s.agent === 'claude' && s.child) {
    const old = s.child
    s.child = null
    try {
      old.kill()
    } catch {
      /* already gone */
    }
  }
  touch(s, id)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startChatAgent(
  win: BrowserWindow,
  id: string,
  opts: { cwd: string; agent: ChatAgentId; mode: ChatMode; model?: string | null }
): void {
  stopChatAgent(id)
  const s: Session = {
    win,
    cwd: opts.cwd,
    agent: opts.agent,
    mode: opts.mode,
    pendingMode: null,
    model: opts.model ?? null,
    pendingModel: null,
    reportedModel: null,
    threadId: null,
    messages: [],
    version: 0,
    seq: 0,
    busy: false,
    queue: [],
    child: null,
    stdoutRest: '',
    stderrTail: '',
    turnClosed: true
  }
  sessions.set(id, s)
  // Claude starts eagerly so the first turn has no spawn latency; codex spawns
  // per turn by design.
  if (s.agent === 'claude') ensureClaude(s, id)
  touch(s, id)
}

export function sendChatAgent(id: string, text: string): void {
  const s = sessions.get(id)
  if (!s || !text.trim()) return
  push(s, id, [{ kind: 'user', text }])
  if (s.busy) {
    s.queue.push(text)
    touch(s, id)
    return
  }
  startTurn(s, id, text)
}

export function setChatAgentMode(id: string, mode: ChatMode): void {
  const s = sessions.get(id)
  if (!s || s.mode === mode) return
  // Mid-turn switches wait: killing claude now would abandon the turn, and a
  // codex turn already carries its sandbox flag.
  if (s.busy) {
    s.pendingMode = mode
    s.mode = mode
    touch(s, id)
    return
  }
  respawnWith(s, id, mode, s.model)
}

export function setChatAgentModel(id: string, model: string | null): void {
  const s = sessions.get(id)
  if (!s || s.model === model) return
  if (s.busy) {
    s.pendingModel = model
    s.model = model
    touch(s, id)
    return
  }
  // Claude reports the model it resolved on the next init; until then the
  // picked one is what to show.
  s.reportedModel = null
  respawnWith(s, id, s.mode, model)
}

/** Stop the in-flight turn (and anything queued) without ending the session. */
export function interruptChatAgent(id: string): void {
  const s = sessions.get(id)
  if (!s) return
  s.queue = []
  const child = s.child
  s.child = null
  if (child) {
    try {
      child.kill()
    } catch {
      /* already gone */
    }
  }
  if (s.busy) push(s, id, [{ kind: 'notice', text: 'Stopped.' }])
  s.busy = false
  s.turnClosed = true
  touch(s, id)
}

export function stopChatAgent(id: string): void {
  const s = sessions.get(id)
  if (!s) return
  sessions.delete(id)
  const child = s.child
  s.child = null
  if (child) {
    try {
      child.kill()
    } catch {
      /* already gone */
    }
  }
  if (!s.win.isDestroyed()) s.win.webContents.send('chatAgent:closed', { id })
}

export function stopAllChatAgents(): void {
  for (const id of [...sessions.keys()]) stopChatAgent(id)
}

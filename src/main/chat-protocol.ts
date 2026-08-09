import { clipSummary, toolSummary } from './summarize'

/**
 * Parsers for the two agent CLIs' structured chat protocols. Both are pure
 * line-in → events-out functions so the whole protocol surface is unit
 * testable without spawning anything:
 *
 *   - Claude Code: `claude --print --input-format stream-json
 *     --output-format stream-json` — one long-lived process, messages in and
 *     events out over stdio.
 *   - Codex: `codex exec --json` (and `… resume <thread>`) — one process per
 *     turn, JSONL events on stdout.
 *
 * Neither involves a TUI, so nothing can stall on an invisible prompt.
 */

/** A row of the conversation, or an internal control signal (session/turn-end). */
export interface ParsedEvent {
  kind: 'assistant' | 'tool' | 'error' | 'session' | 'turn-end' | 'model'
  /** Message markdown, tool summary, error text, session id, or model id. */
  text: string
  /** Display label for `tool` rows. */
  tool?: string
}

/** One selectable model for an agent. */
export interface ModelOption {
  id: string
  label: string
}

/**
 * Models Codex offers, read from the cache it maintains at
 * ~/.codex/models_cache.json. Collected structurally (any object carrying a
 * slug + display_name) so a schema change can't silently empty the picker.
 */
export function parseCodexModels(cache: unknown): ModelOption[] {
  const found = new Map<string, string>()
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if (typeof obj.slug === 'string' && typeof obj.display_name === 'string' && obj.slug)
      found.set(obj.slug, obj.display_name)
    for (const value of Object.values(obj)) walk(value)
  }
  walk(cache)
  return [...found].map(([id, label]) => ({ id, label }))
}

/** Longest chat message kept; agents can emit very large blocks. */
const MAX_TEXT_LENGTH = 20_000

function clip(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) + ' …' : text
}

/** `mcp__figma__get_file` reads better as `figma.get_file`. */
export function prettyToolName(name: string): string {
  const parts = name.split('__')
  return parts[0] === 'mcp' && parts.length >= 3
    ? `${parts[1]}.${parts.slice(2).join('__')}`
    : name
}

function parseJson(line: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(line) as unknown
    return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Parse one line of Claude Code's stream-json output. */
export function parseClaudeStreamLine(line: string): ParsedEvent[] {
  const obj = parseJson(line)
  if (!obj) return []

  if (obj.type === 'system' && obj.subtype === 'init') {
    const events: ParsedEvent[] = []
    if (typeof obj.session_id === 'string') events.push({ kind: 'session', text: obj.session_id })
    // The model Claude actually resolved, which may differ from what was asked.
    if (typeof obj.model === 'string') events.push({ kind: 'model', text: obj.model })
    return events
  }

  if (obj.type === 'assistant') {
    const message = obj.message as { content?: unknown } | undefined
    if (!Array.isArray(message?.content)) return []
    const events: ParsedEvent[] = []
    for (const item of message.content) {
      if (!item || typeof item !== 'object') continue
      const it = item as { type?: string; text?: string; name?: string; input?: unknown }
      if (it.type === 'text' && typeof it.text === 'string' && it.text.trim())
        events.push({ kind: 'assistant', text: clip(it.text) })
      else if (it.type === 'tool_use' && typeof it.name === 'string')
        events.push({ kind: 'tool', tool: prettyToolName(it.name), text: toolSummary(it.input) })
    }
    return events
  }

  if (obj.type === 'result') {
    const events: ParsedEvent[] = []
    if (obj.is_error === true) {
      const text =
        typeof obj.result === 'string' && obj.result.trim()
          ? clipSummary(obj.result)
          : 'Claude could not complete that turn.'
      events.push({ kind: 'error', text })
    }
    events.push({ kind: 'turn-end', text: '' })
    return events
  }

  if (obj.type === 'rate_limit_event') {
    const info = obj.rate_limit_info as { status?: string } | undefined
    if (info?.status === 'rejected')
      return [{ kind: 'error', text: 'Rate limit reached — Claude can’t reply right now.' }]
  }

  return []
}

/** Codex item types that carry no useful chat row of their own. */
const CODEX_SILENT_ITEMS = new Set(['reasoning', 'todo_list'])

/** Friendly labels for codex's structured item types. */
const CODEX_ITEM_LABELS: Record<string, string> = {
  command_execution: 'Run',
  file_change: 'Edit',
  web_search: 'Search',
  mcp_tool_call: 'Tool'
}

/** Summarize one completed codex item into a tool row's label + detail. */
function codexItemRow(item: Record<string, unknown>): ParsedEvent | null {
  const type = typeof item.type === 'string' ? item.type : ''
  if (CODEX_SILENT_ITEMS.has(type)) return null

  if (type === 'command_execution') {
    const command = typeof item.command === 'string' ? item.command : ''
    // Strip the `/bin/zsh -lc '…'` wrapper codex runs commands through.
    const inner = command.match(/^\S*(?:sh|zsh|bash)\s+-\w*c\s+'([\s\S]*)'$/)
    return { kind: 'tool', tool: 'Run', text: clipSummary(inner ? inner[1] : command) }
  }

  if (type === 'file_change') {
    const changes = Array.isArray(item.changes) ? item.changes : []
    const paths = changes
      .map((c) => (c && typeof c === 'object' ? (c as { path?: unknown }).path : null))
      .filter((p): p is string => typeof p === 'string')
    return { kind: 'tool', tool: 'Edit', text: clipSummary(paths.join(', ')) }
  }

  if (type === 'mcp_tool_call') {
    const server = typeof item.server === 'string' ? item.server : ''
    const tool = typeof item.tool === 'string' ? item.tool : ''
    return { kind: 'tool', tool: [server, tool].filter(Boolean).join('.') || 'Tool', text: '' }
  }

  if (type === 'error') {
    const message = typeof item.message === 'string' ? item.message : 'Codex reported an error.'
    return { kind: 'error', text: clipSummary(message) }
  }

  // Unknown item types still surface as a row rather than vanishing silently.
  return { kind: 'tool', tool: CODEX_ITEM_LABELS[type] ?? type, text: toolSummary(item) }
}

/** Parse one line of `codex exec --json` output. */
export function parseCodexExecLine(line: string): ParsedEvent[] {
  const obj = parseJson(line)
  if (!obj) return []

  if (obj.type === 'thread.started')
    return typeof obj.thread_id === 'string' ? [{ kind: 'session', text: obj.thread_id }] : []

  if (obj.type === 'item.completed') {
    const item = obj.item as Record<string, unknown> | undefined
    if (!item || typeof item !== 'object') return []
    if (item.type === 'agent_message') {
      const text = typeof item.text === 'string' ? item.text : ''
      return text.trim() ? [{ kind: 'assistant', text: clip(text) }] : []
    }
    const row = codexItemRow(item)
    return row ? [row] : []
  }

  if (obj.type === 'turn.completed') return [{ kind: 'turn-end', text: '' }]

  if (obj.type === 'turn.failed') {
    const error = obj.error as { message?: unknown } | undefined
    const text =
      typeof error?.message === 'string' && error.message.trim()
        ? clipSummary(error.message)
        : 'Codex could not complete that turn.'
    return [
      { kind: 'error', text },
      { kind: 'turn-end', text: '' }
    ]
  }

  if (obj.type === 'error') {
    const message = typeof obj.message === 'string' ? obj.message : 'Codex reported an error.'
    return [
      { kind: 'error', text: clipSummary(message) },
      { kind: 'turn-end', text: '' }
    ]
  }

  return []
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDown, ChevronRight, Info, Square, TriangleAlert, Wrench } from 'lucide-react'
import PaneHeader from './PaneHeader'
import PaneFooter, { PaneFooterButton } from './PaneFooter'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { AgentIcon } from '../lib/toolIcons'
import { useStore, type Agent } from '../store/useStore'

/** Mirrors of the preload types (duplicate-by-design, like DirEntry). */
type AgentCli = 'claude' | 'codex'
type ChatMode = 'read-only' | 'auto' | 'full-access'

interface ChatMessage {
  seq: number
  kind: 'user' | 'assistant' | 'tool' | 'error' | 'notice'
  text: string
  tool?: string
}

interface ChatState {
  agent: AgentCli
  mode: ChatMode
  model: string | null
  reportedModel: string | null
  busy: boolean
  queued: number
  version: number
  messages: ChatMessage[]
}

interface ModelOption {
  id: string
  label: string
}

/** The agents the chat panel can run, in picker order. */
const CHAT_AGENT_IDS: AgentCli[] = ['claude', 'codex']

/**
 * One permission vocabulary for both agents; main maps each to that CLI's own
 * flag. Every level works headlessly — none of them can strand the chat on an
 * invisible approval prompt.
 */
const MODES: { id: ChatMode; label: string; hint: string }[] = [
  { id: 'read-only', label: 'Read Only', hint: 'Explore and plan; no edits or commands' },
  { id: 'auto', label: 'Auto', hint: 'Edit files and run commands in this project' },
  { id: 'full-access', label: 'Full Access', hint: 'No sandbox or approval limits' }
]

const AGENT_LABELS: Record<AgentCli, string> = { claude: 'Claude', codex: 'Codex' }

// Native agent builds can report their process name with an .exe suffix even
// on macOS (e.g. the Bun-compiled `claude` binary shows up as `claude.exe`).
function commandName(command: string): string {
  const base = command.trim().split(/\s+/)[0]?.split('/').pop()?.replace(/^-/, '') ?? ''
  return base.replace(/\.exe$/i, '')
}

/** Consecutive tool rows fold into one collapsible group between messages. */
type Block =
  | { type: 'message'; message: ChatMessage }
  | { type: 'tools'; items: ChatMessage[]; key: number }

function toBlocks(messages: ChatMessage[]): Block[] {
  const blocks: Block[] = []
  for (const message of messages) {
    const last = blocks[blocks.length - 1]
    if (message.kind === 'tool') {
      if (last?.type === 'tools') last.items.push(message)
      else blocks.push({ type: 'tools', items: [message], key: message.seq })
    } else {
      blocks.push({ type: 'message', message })
    }
  }
  return blocks
}

/**
 * Agent chat for the active project. Claude and Codex both run over their
 * structured protocols (main owns the session; see chat-agent.ts), so
 * messages queue reliably and failures surface as visible rows. When no chat
 * session is running, the panel falls back to mirroring an agent the user
 * started in one of the project's terminals.
 */
export default function ChatPanel(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const sessionProcesses = useStore((s) => s.sessionProcesses)
  const agents = useStore((s) => s.agents)

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const project = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : projects[0]
  const projectId = project?.id ?? ''
  const cwd = project?.path || ''

  const [chat, setChat] = useState<ChatState | null>(null)
  const chatRef = useRef<ChatState | null>(null)
  const [starting, setStarting] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  // Stick to the bottom unless the user has scrolled up to read history.
  const stickToBottom = useRef(true)

  const apply = useCallback((next: ChatState | null) => {
    chatRef.current = next
    setChat(next)
  }, [])

  // Main owns the conversation; the panel takes a snapshot on mount and then
  // applies deltas, refetching whenever it notices a missed version.
  useEffect(() => {
    let cancelled = false
    apply(null)
    setExpanded(new Set())
    stickToBottom.current = true
    if (!projectId) return
    const refresh = async (): Promise<void> => {
      const state = (await window.api.chatAgent.state(projectId)) as ChatState | null
      if (!cancelled) apply(state)
    }
    void refresh()
    const offUpdate = window.api.chatAgent.onUpdate((update) => {
      if (update.id !== projectId) return
      const current = chatRef.current
      if (!current || update.version !== current.version + 1) {
        void refresh()
        return
      }
      apply({
        agent: update.agent,
        mode: update.mode,
        model: update.model,
        reportedModel: update.reportedModel,
        busy: update.busy,
        queued: update.queued,
        version: update.version,
        messages: update.appended.length
          ? [...current.messages, ...update.appended]
          : current.messages
      })
    })
    const offClosed = window.api.chatAgent.onClosed((id) => {
      if (id === projectId) apply(null)
    })
    return () => {
      cancelled = true
      offUpdate()
      offClosed()
    }
  }, [projectId, apply])

  // Fallback: an agent the user started in one of this project's terminals.
  const terminalAgent = useMemo((): { sessionId: string; agent: AgentCli } | null => {
    const ids = project?.sessionIds ?? []
    const agentOf = (id: string): AgentCli | null => {
      const proc = commandName(sessionProcesses[id] ?? '')
      if (proc === 'claude' || proc === 'codex') return proc
      if (!sessionProcesses[id]) {
        const cmd = commandName(sessions[id]?.command ?? '')
        if (cmd === 'claude' || cmd === 'codex') return cmd
      }
      return null
    }
    if (activeSessionId && ids.includes(activeSessionId)) {
      const agent = agentOf(activeSessionId)
      if (agent) return { sessionId: activeSessionId, agent }
    }
    for (const id of ids) {
      const agent = agentOf(id)
      if (agent) return { sessionId: id, agent }
    }
    return null
  }, [project, sessions, sessionProcesses, activeSessionId])

  // Mirror a terminal agent only while no chat session owns the panel — and
  // only when one is actually running, so an unrelated transcript can never
  // masquerade as this project's conversation.
  const mirroring = !chat && !!terminalAgent
  const [mirrorMessages, setMirrorMessages] = useState<ChatMessage[]>([])
  const [pendingSends, setPendingSends] = useState<string[]>([])

  useEffect(() => {
    setMirrorMessages([])
    setPendingSends([])
    if (!mirroring || !cwd) return
    window.api.transcripts.watch(cwd)
    window.api.transcripts.follow(cwd, null, 0)
    let seq = 0
    const offEvents = window.api.transcripts.onEvents((root, batch) => {
      if (root !== cwd) return
      const rows = batch
        .filter((ev) => ev.kind !== 'mode')
        .map((ev) => ({
          seq: seq++,
          kind: ev.kind as ChatMessage['kind'],
          text: ev.text,
          tool: ev.tool
        }))
      if (rows.length) setMirrorMessages((prev) => [...prev, ...rows])
      const arrived = batch.filter((ev) => ev.kind === 'user').map((ev) => ev.text.trim())
      if (arrived.length)
        setPendingSends((prev) => prev.filter((text) => !arrived.includes(text.trim())))
    })
    const offReset = window.api.transcripts.onReset((root) => {
      if (root === cwd) setMirrorMessages([])
    })
    return () => {
      offEvents()
      offReset()
      window.api.transcripts.unwatch(cwd)
    }
  }, [mirroring, cwd])

  const messages = chat ? chat.messages : mirrorMessages
  const blocks = useMemo(() => toBlocks(messages), [messages])
  // Tool steps are shown folded into groups, so they don't count as messages.
  const messageCount = useMemo(
    () => messages.filter((m) => m.kind === 'user' || m.kind === 'assistant').length,
    [messages]
  )
  const busy = chat?.busy ?? (mirroring && pendingSends.length > 0)
  const agentId: AgentCli | null = chat?.agent ?? terminalAgent?.agent ?? null
  const agentLabel = agentId ? AGENT_LABELS[agentId] : null

  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  })

  // Content fades out at the bottom edge while there is more below it.
  const [atBottom, setAtBottom] = useState(true)
  const syncScrollEdge = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottom.current = distance < 48
    setAtBottom(distance < 8)
  }, [])
  useEffect(syncScrollEdge)

  const send = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    if (chat) {
      window.api.chatAgent.send(projectId, text)
    } else if (terminalAgent) {
      // Multi-line input goes through as a bracketed paste so the agent's TUI
      // treats inner newlines as content, not as submissions.
      const payload = text.includes('\n') ? `\x1b[200~${text}\x1b[201~` : text
      window.api.pty.input(terminalAgent.sessionId, payload + '\r')
      setPendingSends((prev) => [...prev, text])
    } else {
      return
    }
    setDraft('')
    stickToBottom.current = true
  }, [draft, chat, projectId, terminalAgent])

  const startAgent = useCallback(
    (agent: Agent) => {
      if (!project || starting) return
      setStarting(true)
      void (async () => {
        try {
          setPickError(null)
          const available = await window.api.agent.probe(agent.command)
          if (!available) {
            setPickError(`${agent.name} isn’t installed — its command wasn’t found on your PATH.`)
            return
          }
          window.api.chatAgent.start(project.id, project.path, agent.id as AgentCli, 'auto')
        } finally {
          setStarting(false)
        }
      })()
    },
    [project, starting]
  )

  const selectMode = useCallback(
    (mode: ChatMode) => {
      if (chat) window.api.chatAgent.setMode(projectId, mode)
    },
    [chat, projectId]
  )

  // The model list belongs to whichever agent is running, so it reloads when
  // the session's agent changes.
  const chatAgentId = chat?.agent
  const [models, setModels] = useState<ModelOption[]>([])
  useEffect(() => {
    let cancelled = false
    if (!chatAgentId) {
      setModels([])
      return
    }
    void window.api.chatAgent.models(chatAgentId).then((list) => {
      if (!cancelled) setModels(list as ModelOption[])
    })
    return () => {
      cancelled = true
    }
  }, [chatAgentId])

  // What the agent reported wins over what was picked — they differ when an
  // alias resolves (claude "sonnet" → "claude-sonnet-5") or a request falls back.
  const activeModel = useMemo(() => {
    if (!chat) return null
    const reported = chat.reportedModel
    if (reported) {
      const exact = models.find((m) => m.id === reported)
      if (exact) return exact
      const alias = models.find((m) => reported.includes(m.id))
      if (alias) return alias
      return { id: reported, label: reported }
    }
    return models.find((m) => m.id === chat.model) ?? null
  }, [chat, models])

  const toggleGroup = useCallback((key: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const pickerAgents = CHAT_AGENT_IDS.map((id) => agents.find((a) => a.id === id)).filter(
    (a): a is Agent => !!a
  )
  const canType = !!chat || !!terminalAgent
  const currentMode = MODES.find((m) => m.id === chat?.mode)
  const lastBlock = blocks[blocks.length - 1]
  const liveGroupKey = busy && lastBlock?.type === 'tools' ? lastBlock.key : null

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title="Chat" />

      <div
        ref={scrollRef}
        data-chat-log=""
        onScroll={syncScrollEdge}
        className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 ${
          atBottom ? '' : 'ultra-fade-bottom'
        }`}
      >
        {blocks.length === 0 && pendingSends.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-xs text-muted-foreground">
              {!cwd
                ? 'Open a project to chat with an agent.'
                : canType
                  ? `Say something to get started with ${agentLabel}.`
                  : 'Pick an agent to chat with in this project.'}
            </p>
            {cwd && !canType && <AgentPicker agents={pickerAgents} onPick={startAgent} />}
            {pickError && <p className="text-xs text-destructive">{pickError}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {blocks.map((block) =>
              block.type === 'message' ? (
                <MessageRow
                  key={block.message.seq}
                  message={block.message}
                  agent={agentId ?? 'claude'}
                />
              ) : (
                <ToolGroup
                  key={block.key}
                  items={block.items}
                  live={block.key === liveGroupKey}
                  open={block.key === liveGroupKey || expanded.has(block.key)}
                  onToggle={() => toggleGroup(block.key)}
                />
              )
            )}
            {pendingSends.map((text, i) => (
              <div key={`pending-${i}`} className="flex justify-end opacity-60">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-secondary px-3 py-1.5 text-[13px] leading-5">
                  {text}
                </div>
              </div>
            ))}
            {busy && (
              <p className="animate-pulse pl-6 text-[11px] italic text-muted-foreground">
                {agentLabel} is working…
              </p>
            )}
          </div>
        )}
      </div>

      {canType && (
        <div className="flex flex-none items-end px-3 py-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter makes a new line. Never submit while
              // an IME candidate window is open.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
            rows={Math.min(4, Math.max(1, draft.split('\n').length))}
            placeholder={busy ? `Queue a message for ${agentLabel}…` : `Message ${agentLabel}…`}
            className="min-w-0 flex-1 resize-none rounded-xl border border-input bg-secondary/40 px-3 py-1.5 text-[13px] leading-5 outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      <PaneFooter>
        {chat && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <PaneFooterButton title="What the agent is allowed to do">
                  {currentMode?.label ?? 'Mode'}
                  <ChevronDown className="h-3 w-3" />
                </PaneFooterButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                {MODES.map((mode) => (
                  <DropdownMenuItem
                    key={mode.id}
                    onSelect={() => selectMode(mode.id)}
                    className="flex-col items-start gap-0"
                  >
                    <span className="flex w-full items-center gap-2">
                      {mode.label}
                      {mode.id === chat.mode && (
                        <span className="ml-auto text-muted-foreground">✓</span>
                      )}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{mode.hint}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {models.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <PaneFooterButton title={`Model ${AGENT_LABELS[chat.agent]} runs`}>
                    <span className="max-w-[10rem] truncate">{activeModel?.label ?? 'Model'}</span>
                    <ChevronDown className="h-3 w-3 flex-none" />
                  </PaneFooterButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                  {models.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onSelect={() => window.api.chatAgent.setModel(projectId, model.id)}
                    >
                      {model.label}
                      {model.id === activeModel?.id && (
                        <span className="ml-auto text-muted-foreground">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {busy ? (
              <PaneFooterButton
                onClick={() => window.api.chatAgent.interrupt(projectId)}
                title="Stop the current turn"
              >
                <Square className="h-2.5 w-2.5 fill-current" />
                Stop
              </PaneFooterButton>
            ) : (
              <PaneFooterButton
                onClick={() => window.api.chatAgent.stop(projectId)}
                title="End this chat session"
              >
                End
              </PaneFooterButton>
            )}
            {chat.queued > 0 && <span>{chat.queued} queued</span>}
          </>
        )}
        {mirroring && <span>mirroring terminal</span>}
        {messageCount > 0 && <span className="ml-auto">{messageCount} messages</span>}
      </PaneFooter>
    </div>
  )
}

function AgentPicker({
  agents,
  onPick
}: {
  agents: Agent[]
  onPick: (agent: Agent) => void
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {agents.map((agent) => (
        <Button
          key={agent.id}
          variant="secondary"
          size="sm"
          className="h-7 gap-1.5 rounded-full px-3 text-xs"
          onClick={() => onPick(agent)}
        >
          <AgentIcon command={agent.command} className="h-3.5 w-3.5" />
          {agent.name}
        </Button>
      ))}
    </div>
  )
}

function ToolGroup({
  items,
  open,
  live,
  onToggle
}: {
  items: ChatMessage[]
  open: boolean
  live: boolean
  onToggle: () => void
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={live}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors enabled:hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 flex-none" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-none" />
        )}
        <Wrench className="h-3 w-3 flex-none" />
        <span>
          {items.length} {items.length === 1 ? 'step' : 'steps'}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <div
              key={item.seq}
              className="flex min-w-0 items-center gap-1.5 pl-6 text-[11px] text-muted-foreground"
            >
              <span className="flex-none font-medium">{item.tool}</span>
              {item.text && <span className="truncate opacity-75">{item.text}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MessageRow({
  message,
  agent
}: {
  message: ChatMessage
  agent: AgentCli
}): JSX.Element {
  if (message.kind === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-secondary px-3 py-1.5 text-[13px] leading-5">
          {message.text}
        </div>
      </div>
    )
  }

  if (message.kind === 'error' || message.kind === 'notice') {
    const isError = message.kind === 'error'
    const Icon = isError ? TriangleAlert : Info
    return (
      <div
        className={`flex items-start gap-1.5 pl-6 text-[11px] ${isError ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        <Icon className="mt-0.5 h-3 w-3 flex-none" />
        <span className="whitespace-pre-wrap break-words">{message.text}</span>
      </div>
    )
  }

  return (
    <div className="flex">
      <div className="prose prose-sm dark:prose-invert min-w-0 max-w-none flex-1 break-words text-[13px] leading-5 prose-p:my-1.5 prose-pre:my-2 prose-pre:overflow-x-auto">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault()
                  if (href) window.api.app.openExternal(href)
                }}
              >
                {children}
              </a>
            )
          }}
        >
          {message.text}
        </ReactMarkdown>
      </div>
    </div>
  )
}

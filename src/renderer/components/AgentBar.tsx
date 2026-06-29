import { Fragment } from 'react'
import { useStore } from '../store/useStore'
import type { Agent } from '../store/useStore'
import { AgentIcon } from '../lib/toolIcons'

/**
 * Floating quick-launch bar shown at the bottom of a plain shell. Lists the
 * defined agents (most-recently-used first) and runs the chosen one in the
 * current shell.
 */
export default function AgentBar({ sessionId }: { sessionId: string }): JSX.Element | null {
  const agents = useStore((s) => s.agents)
  const recentAgentIds = useStore((s) => s.recentAgentIds)
  const startAgent = useStore((s) => s.startAgent)

  if (agents.length === 0) return null

  // Recently-used agents first (in usage order), then the rest as defined.
  const rank = (a: Agent): number => {
    const i = recentAgentIds.indexOf(a.id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const ordered = [...agents].sort((a, b) => rank(a) - rank(b))

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
      <div className="pointer-events-auto flex items-center rounded-2xl border border-border bg-popover/90 p-1 shadow-lg backdrop-blur [corner-shape:squircle]">
        {ordered.map((agent, i) => (
          <Fragment key={agent.id}>
            {i > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-border" />}
            <button
              onClick={() => startAgent(sessionId, agent)}
              title={`Run ${agent.command}`}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground [corner-shape:squircle]"
            >
              <AgentIcon command={agent.command} className="h-3.5 w-3.5" />
              {agent.name}
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

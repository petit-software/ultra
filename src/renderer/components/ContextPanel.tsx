import { useState } from 'react'
import { FileText, X, CornerDownLeft } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { basename, relTo } from '../lib/paths'
import { cn } from '@/lib/utils'

export default function ContextPanel(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const pinContext = useStore((s) => s.pinContext)
  const unpinContext = useStore((s) => s.unpinContext)

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const project = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : projects[0]
  const pinned = project?.contextPaths ?? []

  const [over, setOver] = useState(false)

  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setOver(false)
    if (!project) return
    const paths: string[] = []
    const internal = e.dataTransfer.getData('application/x-ultra-path')
    if (internal) paths.push(internal)
    for (const f of Array.from(e.dataTransfer.files)) {
      const p = (f as File & { path?: string }).path
      if (p) paths.push(p)
    }
    if (!paths.length) return
    // Expand any dropped folders to the files inside them.
    const files = await window.api.fs.expandToFiles(paths)
    if (files.length) pinContext(project.id, files)
  }

  /** Type `@relpath ` into the active terminal so the agent can read the file. */
  const insert = (paths: string[]): void => {
    if (!activeSessionId || !project) return
    const text = paths.map((p) => `@${relTo(project.path, p)}`).join(' ') + ' '
    window.api.pty.input(activeSessionId, text)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => void onDrop(e)}
      className={cn(
        'flex min-h-0 flex-1 flex-col border-2 border-dashed transition-colors',
        over ? 'border-primary bg-primary/10' : 'border-transparent'
      )}
    >
      {pinned.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">
          {project
            ? 'Drag files here from the tree or Finder. Pinned files can be sent into the agent terminal as @mentions.'
            : 'Open a project to pin context.'}
        </div>
      ) : (
        <>
          <ul className="min-h-0 flex-1 overflow-auto px-2 py-2">
            {pinned.map((p) => (
              <li
                key={p}
                onClick={() => insert([p])}
                className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary/60"
                title={`Insert @${project ? relTo(project.path, p) : p}`}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{basename(p)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (project) unpinContext(project.id, p)
                  }}
                  className="text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
                  title="Unpin"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          {/* Send-to-agent bar, pinned to the bottom */}
          <div className="flex flex-none items-center justify-between border-t border-border px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground">{pinned.length} pinned</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1.5 text-xs"
                  disabled={!activeSessionId}
                  onClick={() => insert(pinned)}
                >
                  <CornerDownLeft className="h-3 w-3" />
                  Send to agent
                </Button>
              </TooltipTrigger>
              <TooltipContent>Insert all as @mentions in the active terminal</TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  )
}

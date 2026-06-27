import { useState } from 'react'
import { FileText, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { cn } from '@/lib/utils'

const basename = (p: string): string => p.replace(/\/+$/, '').split('/').pop() || p

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

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setOver(false)
    if (!project) return

    const paths: string[] = []
    // Internal drag from the file tree.
    const internal = e.dataTransfer.getData('application/x-ultra-path')
    if (internal) paths.push(internal)
    // Files dragged in from Finder (Electron augments File with .path).
    for (const f of Array.from(e.dataTransfer.files)) {
      const p = (f as File & { path?: string }).path
      if (p) paths.push(p)
    }
    if (paths.length) pinContext(project.id, paths)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        'flex-none border-t border-dashed transition-colors',
        over ? 'border-primary bg-primary/10' : 'border-transparent'
      )}
    >
      {pinned.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">
          {project
            ? 'Drag files here from the tree or Finder to pin them as agent context.'
            : 'Open a project to pin context.'}
        </div>
      ) : (
        <ul className="max-h-40 overflow-auto p-2">
          {pinned.map((p) => (
            <li
              key={p}
              className="group flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary/60"
              title={p}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{basename(p)}</span>
              <button
                onClick={() => project && unpinContext(project.id, p)}
                className="text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
                title="Unpin"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

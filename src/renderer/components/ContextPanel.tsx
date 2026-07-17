import { useState } from 'react'
import { FileText, Link2, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { basename, relTo, isUrl } from '../lib/paths'
import { cn } from '@/lib/utils'

const itemLabel = (p: string): string =>
  isUrl(p) ? p.replace(/^https?:\/\//i, '').replace(/\/+$/, '') : basename(p)

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

  // Only react to payloads this panel can pin: Finder files, file-tree paths,
  // or links/text. Internal UI drags (panels, project rows) declare only their
  // own MIME, so they fall through to the sidebar's panel drop handling.
  const canAccept = (e: React.DragEvent): boolean =>
    ['Files', 'application/x-ultra-path', 'text/uri-list', 'text/plain'].some((t) =>
      e.dataTransfer.types.includes(t)
    )

  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setOver(false)
    if (!project) return

    const items: string[] = []
    // Internal drag from the file tree.
    const internal = e.dataTransfer.getData('application/x-ultra-path')
    if (internal) items.push(internal)
    // Links dragged from a browser.
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (uri) uri.split(/\r?\n/).forEach((u) => isUrl(u.trim()) && items.push(u.trim()))
    // Files/folders dropped from Finder (Electron 32+: File.path is gone).
    for (const f of Array.from(e.dataTransfer.files)) {
      const p = window.api.getPathForFile(f)
      if (p) items.push(p)
    }
    if (!items.length) return

    const urls = items.filter(isUrl)
    const fsPaths = items.filter((p) => !isUrl(p))
    // Expand any dropped folders to the files inside them.
    const files = fsPaths.length ? await window.api.fs.expandToFiles(fsPaths) : []
    const all = [...new Set([...urls, ...files])]
    if (all.length) pinContext(project.id, all)
  }

  /** Insert pinned items into the active terminal: @relpath for files, raw URL for links. */
  const insert = (paths: string[]): void => {
    if (!activeSessionId || !project) return
    const text =
      paths.map((p) => (isUrl(p) ? p : `@${relTo(project.path, p)}`)).join(' ') + ' '
    window.api.pty.input(activeSessionId, text)
  }

  return (
    <div
      onDragOver={(e) => {
        if (!canAccept(e)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!canAccept(e)) return
        void onDrop(e)
      }}
      className={cn(
        'flex min-h-0 flex-1 flex-col border-2 border-dashed transition-colors',
        over ? 'border-primary bg-primary/10' : 'border-transparent'
      )}
    >
      {pinned.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">
          {project
            ? 'Add files, folders, or links with the + above, or drag them here from the tree, Finder, or your browser. Pinned items send into the agent terminal as @mentions (files) or URLs (links).'
            : 'Open a project to pin context.'}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto px-2 py-2">
          {pinned.map((p) => (
            <li
              key={p}
              onClick={() => insert([p])}
              className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary/60"
              title={isUrl(p) ? `Insert ${p}` : `Insert @${project ? relTo(project.path, p) : p}`}
            >
              {isUrl(p) ? (
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1 truncate">{itemLabel(p)}</span>
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
      )}
    </div>
  )
}

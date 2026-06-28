import { useState } from 'react'
import PaneHeader from './PaneHeader'
import FileTree from './FileTree'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useStore } from '../store/useStore'
import type { DirEntry } from '../types'

/** Path relative to the project root, for terminal @mentions. */
function relTo(root: string, p: string): string {
  const r = root.replace(/\/+$/, '')
  return r && p.startsWith(r + '/') ? p.slice(r.length + 1) : p
}

export default function FilesPanel(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const editorCommand = useStore((s) => s.editorCommand)

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const project = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : null
  const root = project?.path || ''

  const [preview, setPreview] = useState<{ name: string; body: string } | null>(null)

  const openFile = async (entry: DirEntry): Promise<void> => {
    const res = await window.api.fs.readFile(entry.path)
    setPreview({
      name: entry.name,
      body: res.tooLarge ? '[binary or file too large to preview]' : res.content
    })
  }

  const sendToAgent = (entry: DirEntry): void => {
    if (!activeSessionId) return
    window.api.pty.input(activeSessionId, `@${relTo(root, entry.path)} `)
  }

  return (
    <div className="flex h-full flex-col">
      <PaneHeader title="Files" />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {root ? (
          <FileTree
            root={root}
            onOpenFile={(e) => void openFile(e)}
            onSend={sendToAgent}
            onEdit={(e) => void window.api.editor.open(editorCommand, e.path)}
          />
        ) : (
          <div className="space-y-1 p-4 text-sm text-muted-foreground">
            <p>No folder open.</p>
            <p>Open a folder from the Projects sidebar to browse its files.</p>
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1">
            <pre className="whitespace-pre-wrap break-words p-1 font-mono text-xs leading-relaxed text-foreground">
              {preview?.body}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

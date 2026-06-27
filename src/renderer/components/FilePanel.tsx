import { useState } from 'react'
import PaneHeader from './PaneHeader'
import FileTree from './FileTree'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useStore } from '../store/useStore'
import type { DirEntry } from '../types'

export default function FilePanel(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)

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

  return (
    <div className="flex h-full flex-col">
      <PaneHeader title="Files" />
      <ScrollArea className="flex-1">
        {root ? (
          <FileTree root={root} onOpenFile={(e) => void openFile(e)} />
        ) : (
          <div className="space-y-1 p-4 text-sm text-muted-foreground">
            <p>No folder open.</p>
            <p>Open a folder from the Projects sidebar to browse its files.</p>
          </div>
        )}
      </ScrollArea>

      <PaneHeader title="Context" className="border-t" />
      <div className="flex-none p-4 text-sm text-muted-foreground">
        Drag files here to pin them as agent context (M7).
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

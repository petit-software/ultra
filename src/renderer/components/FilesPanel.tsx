import { useState } from 'react'
import { Plus, File as FileIcon, Folder, Check } from 'lucide-react'
import PaneHeader from './PaneHeader'
import FileTree from './FileTree'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog'
import { X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { relTo } from '../lib/paths'
import { EditorIcon } from '../lib/toolIcons'
import type { DirEntry } from '../types'

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

  const [preview, setPreview] = useState<{ name: string; path: string; body: string } | null>(null)
  const [creating, setCreating] = useState<'file' | 'dir' | null>(null)
  const [newName, setNewName] = useState('')

  const openFile = async (entry: DirEntry): Promise<void> => {
    const res = await window.api.fs.readFile(entry.path)
    setPreview({
      name: entry.name,
      path: entry.path,
      body: res.tooLarge ? '[binary or file too large to preview]' : res.content
    })
  }

  const sendToAgent = (entry: DirEntry): void => {
    if (!activeSessionId) return
    window.api.pty.input(activeSessionId, `@${relTo(root, entry.path)} `)
  }

  const submitCreate = async (): Promise<void> => {
    const name = newName.trim().replace(/^\/+/, '')
    if (!root || !creating || !name) return
    const path = `${root.replace(/\/+$/, '')}/${name}`
    const ok =
      creating === 'file'
        ? await window.api.fs.createFile(path)
        : await window.api.fs.createDir(path)
    if (!ok) window.alert(`Could not create ${creating === 'file' ? 'file' : 'folder'} (already exists?)`)
    setCreating(null)
    setNewName('')
  }

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title="Files">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={!root} title="Add">
              <Plus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem
              onSelect={() => {
                setNewName('')
                setCreating('file')
              }}
            >
              <FileIcon className="h-4 w-4" />
              New file
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setNewName('')
                setCreating('dir')
              }}
            >
              <Folder className="h-4 w-4" />
              New folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PaneHeader>
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 pr-1">
        {root ? (
          <div>
            {creating && (
              <div className="flex items-center gap-1 py-1 pl-2 pr-1 text-sm">
                <span className="w-3.5 shrink-0" />
                {creating === 'dir' ? (
                  <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={() => setCreating(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitCreate()
                    else if (e.key === 'Escape') setCreating(null)
                  }}
                  placeholder={creating === 'dir' ? 'folder name' : 'file name'}
                  className="min-w-0 flex-1 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  title="Create"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    void submitCreate()
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <FileTree
              root={root}
              onOpenFile={(e) => void openFile(e)}
              onSend={sendToAgent}
              onEdit={(e) => void window.api.editor.open(editorCommand, e.path)}
            />
          </div>
        ) : (
          <div className="space-y-1 p-4 text-sm text-muted-foreground">
            <p>No folder open.</p>
            <p>Open a folder from the Projects sidebar to browse its files.</p>
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent hideClose>
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="truncate">{preview?.name}</DialogTitle>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (preview) void window.api.editor.open(editorCommand, preview.path)
                  }}
                >
                  <EditorIcon command={editorCommand} className="h-4 w-4" />
                  Edit
                </Button>
                <DialogClose className="rounded-sm text-muted-foreground opacity-70 transition hover:opacity-100 focus:outline-none">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </div>
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

import { useState } from 'react'
import { Plus, File as FileIcon, Folder, Eye, Check } from 'lucide-react'
import PaneHeader from './PaneHeader'
import FileTree from './FileTree'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { useStore } from '../store/useStore'
import { relTo } from '../lib/paths'
import type { DirEntry } from '../types'

export default function FilesPanel(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const editorCommand = useStore((s) => s.editorCommand)
  const openFile = useStore((s) => s.openFile)

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const project = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : null
  const root = project?.path || ''

  const [creating, setCreating] = useState<'file' | 'dir' | null>(null)
  const [newName, setNewName] = useState('')

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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              disabled={!root}
              onClick={() => window.api.fs.reveal(root)}
            >
              <Eye />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Show in Finder</TooltipContent>
        </Tooltip>
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-1 pr-1">
        {root ? (
          <div className="px-1.5">
            {creating && (
              <div className="flex items-center gap-1 py-1 pl-2 pr-1 text-xs">
                <span className="w-3.5 shrink-0" />
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
                  className="min-w-0 flex-1 bg-transparent p-0 text-xs text-foreground outline-none placeholder:text-muted-foreground"
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
              onOpenFile={(e) => openFile({ path: e.path, name: e.name })}
              onSend={sendToAgent}
              onEdit={(e) => void window.api.editor.open(editorCommand, e.path)}
            />
          </div>
        ) : (
          <div className="space-y-1 p-4 text-sm text-muted-foreground">
            <p>No folder open.</p>
            <p>Open a folder from the top bar to browse its files.</p>
          </div>
        )}
      </div>
    </div>
  )
}

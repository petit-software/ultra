import { useState } from 'react'
import { Plus, FileText, Folder, Link2 } from 'lucide-react'
import PaneHeader from './PaneHeader'
import ContextPanel from './ContextPanel'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { useStore } from '../store/useStore'
import { isUrl } from '../lib/paths'

export default function ContextSection(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const pinContext = useStore((s) => s.pinContext)

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const project = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : projects[0]

  const [addingLink, setAddingLink] = useState(false)
  const [linkValue, setLinkValue] = useState('')

  const pinFiles = async (): Promise<void> => {
    if (!project) return
    const files = await window.api.dialog.pickFiles()
    if (files.length) pinContext(project.id, files)
  }

  const pinFolder = async (): Promise<void> => {
    if (!project) return
    const dir = await window.api.dialog.pickDirectory()
    if (!dir) return
    const files = await window.api.fs.expandToFiles([dir])
    if (files.length) pinContext(project.id, files)
  }

  const submitLink = (): void => {
    let v = linkValue.trim()
    if (v && !isUrl(v)) v = 'https://' + v
    if (project && isUrl(v)) pinContext(project.id, [v])
    setLinkValue('')
    setAddingLink(false)
  }

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title="Context">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={!project} title="Add">
              <Plus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem onSelect={() => void pinFiles()}>
              <FileText className="h-4 w-4" />
              Add file
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void pinFolder()}>
              <Folder className="h-4 w-4" />
              Add folder
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setLinkValue('')
                setAddingLink(true)
              }}
            >
              <Link2 className="h-4 w-4" />
              Add link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PaneHeader>

      {addingLink && (
        <div className="flex flex-none items-center gap-2 px-3 pb-1 pt-1">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onBlur={() => (linkValue.trim() ? submitLink() : setAddingLink(false))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitLink()
              else if (e.key === 'Escape') {
                setLinkValue('')
                setAddingLink(false)
              }
            }}
            placeholder="https://…"
            className="min-w-0 flex-1 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}

      <ContextPanel />
    </div>
  )
}

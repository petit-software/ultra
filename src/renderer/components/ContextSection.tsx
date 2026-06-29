import { Plus } from 'lucide-react'
import PaneHeader from './PaneHeader'
import ContextPanel from './ContextPanel'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useStore } from '../store/useStore'

export default function ContextSection(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const pinContext = useStore((s) => s.pinContext)

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const project = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : projects[0]

  const pinFolder = async (): Promise<void> => {
    if (!project) return
    const dir = await window.api.dialog.pickDirectory()
    if (!dir) return
    const files = await window.api.fs.expandToFiles([dir])
    if (files.length) pinContext(project.id, files)
  }

  return (
    <div className="flex h-full flex-col">
      <PaneHeader title="Context">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              disabled={!project}
              onClick={() => void pinFolder()}
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pin a folder as context</TooltipContent>
        </Tooltip>
      </PaneHeader>
      <ContextPanel />
    </div>
  )
}

import { Fragment } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import FilesPanel from './FilesPanel'
import EditorPanel from './EditorPanel'
import ContextSection from './ContextSection'
import SidebarTerminal from './SidebarTerminal'
import { useStore, type SidebarBlockKey } from '../store/useStore'

const SECTION = 'overflow-hidden rounded-xl bg-card'
const HANDLE = 'mx-1 bg-transparent data-[panel-group-direction=vertical]:h-2'

const PANELS: {
  key: SidebarBlockKey
  order: number
  defaultSize: number
  minSize: number
  render: () => JSX.Element
}[] = [
  { key: 'files', order: 1, defaultSize: 40, minSize: 15, render: () => <FilesPanel /> },
  { key: 'editor', order: 2, defaultSize: 35, minSize: 15, render: () => <EditorPanel /> },
  { key: 'context', order: 3, defaultSize: 25, minSize: 15, render: () => <ContextSection /> },
  { key: 'terminal', order: 4, defaultSize: 30, minSize: 20, render: () => <SidebarTerminal /> }
]

export default function RightSidebar(): JSX.Element {
  const blocks = useStore((s) => s.sidebarBlocks)
  const visible = PANELS.filter((p) => blocks[p.key])

  return (
    <ResizablePanelGroup direction="vertical" autoSaveId="ultra-right">
      {visible.map((p, i) => (
        <Fragment key={p.key}>
          {i > 0 && <ResizableHandle className={HANDLE} />}
          <ResizablePanel
            id={p.key}
            order={p.order}
            defaultSize={p.defaultSize}
            minSize={p.minSize}
            className={SECTION}
          >
            {p.render()}
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  )
}

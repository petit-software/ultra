import PaneHeader from './PaneHeader'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function FilePanel(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PaneHeader title="Files" />
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-4 text-sm">
          <p>File tree (M4)</p>
          <p className="text-muted-foreground">
            The active project&apos;s tree, live-watched, lands here.
          </p>
        </div>
      </ScrollArea>

      <PaneHeader title="Context" className="border-t" />
      <div className="flex-none p-4 text-sm text-muted-foreground">
        Drag files here to pin them as agent context (M7).
      </div>
    </div>
  )
}

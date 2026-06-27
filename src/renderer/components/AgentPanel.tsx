import { Send } from 'lucide-react'
import PaneHeader from './PaneHeader'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function AgentPanel(): JSX.Element {
  return (
    <div className="flex h-full flex-col bg-background">
      <PaneHeader title="Agent">
        <span className="text-[11px] text-muted-foreground">read-only loop arrives in M5</span>
      </PaneHeader>

      <ScrollArea className="flex-1">
        <div className="p-4 text-sm text-muted-foreground">
          The agent conversation streams here — tool calls render as collapsible cards.
        </div>
      </ScrollArea>

      <div className="flex flex-none gap-2 border-t border-border bg-card p-2">
        <Textarea
          placeholder="Ask the agent… (wired in M5)"
          rows={2}
          disabled
          className="min-h-0 resize-none"
        />
        <Button size="icon" className="h-auto" disabled>
          <Send />
        </Button>
      </div>
    </div>
  )
}

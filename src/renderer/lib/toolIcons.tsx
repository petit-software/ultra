import { VscVscode, VscSparkleFilled } from 'react-icons/vsc'
import {
  SiZedindustries,
  SiSublimetext,
  SiWebstorm,
  SiNeovim,
  SiVim,
  SiClaude,
  SiOpenai
} from 'react-icons/si'
import { Wrench } from 'lucide-react'

type IconComp = React.ComponentType<{ className?: string }>

// Cursor's official cube logo (brand asset), as a currentColor icon so it
// follows the theme. preserveAspectRatio keeps the cube undistorted in a square.
function CursorIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 466.73 532.09" fill="currentColor" className={className} aria-hidden="true">
      <path d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11h-.01ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39h-.01Z" />
    </svg>
  )
}

/** First token of a command, e.g. "subl -n" -> "subl". */
const bin = (command: string): string => command.trim().split(/\s+/)[0]

// Editor command -> logo. VS Code uses its own icon; Cursor uses its cube logo.
const EDITOR_ICONS: Record<string, IconComp> = {
  code: VscVscode,
  cursor: CursorIcon,
  zed: SiZedindustries,
  subl: SiSublimetext,
  webstorm: SiWebstorm,
  nvim: SiNeovim,
  vim: SiVim
}

const AGENT_ICONS: Record<string, IconComp> = {
  claude: SiClaude,
  codex: SiOpenai
}

export function EditorIcon({
  command,
  className
}: {
  command: string
  className?: string
}): JSX.Element {
  const Icon = EDITOR_ICONS[bin(command)] ?? Wrench
  return <Icon className={className} />
}

export function AgentIcon({
  command,
  className
}: {
  command: string
  className?: string
}): JSX.Element {
  const Icon = AGENT_ICONS[bin(command)] ?? VscSparkleFilled
  return <Icon className={className} />
}

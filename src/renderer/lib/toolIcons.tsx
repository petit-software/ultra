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
import { Wrench, MousePointer2 } from 'lucide-react'

type IconComp = React.ComponentType<{ className?: string }>

/** First token of a command, e.g. "subl -n" -> "subl". */
const bin = (command: string): string => command.trim().split(/\s+/)[0]

// Editor command -> logo. Simple Icons lacks Cursor, so it gets a cursor-style
// stand-in; VS Code uses its own VS Code icon.
const EDITOR_ICONS: Record<string, IconComp> = {
  code: VscVscode,
  cursor: MousePointer2,
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

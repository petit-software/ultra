import { TbBrandVscode } from 'react-icons/tb'
import {
  SiZedindustries,
  SiSublimetext,
  SiWebstorm,
  SiNeovim,
  SiVim,
  SiClaude,
  SiOpenai
} from 'react-icons/si'
import { Wrench, Bot, MousePointer2 } from 'lucide-react'

type IconComp = React.ComponentType<{ className?: string }>

/** First token of a command, e.g. "subl -n" -> "subl". */
const bin = (command: string): string => command.trim().split(/\s+/)[0]

// Editor command -> logo. Simple Icons lacks VS Code (Microsoft) and Cursor,
// so VS Code uses Tabler's brand glyph and Cursor a cursor-style stand-in.
const EDITOR_ICONS: Record<string, IconComp> = {
  code: TbBrandVscode,
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
  const Icon = AGENT_ICONS[bin(command)] ?? Bot
  return <Icon className={className} />
}

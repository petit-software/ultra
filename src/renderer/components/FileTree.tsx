import { useEffect, useState, useCallback } from 'react'
import {
  ChevronRight,
  File as FileIcon,
  Folder,
  FolderOpen,
  CornerDownLeft,
  MoreHorizontal,
  FolderOpen as RevealIcon,
  Pencil,
  Trash2
} from 'lucide-react'
import type { DirEntry } from '../types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface NodeProps {
  entry: DirEntry
  depth: number
  version: number
  onOpenFile: (entry: DirEntry) => void
  onSend: (entry: DirEntry) => void
  onEdit: (entry: DirEntry) => void
}

function TreeNode({ entry, depth, version, onOpenFile, onSend, onEdit }: NodeProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<DirEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setChildren(await window.api.fs.listDir(entry.path))
    } catch {
      setChildren([])
    } finally {
      setLoading(false)
    }
  }, [entry.path])

  // Reload an open folder when the workspace changes on disk.
  useEffect(() => {
    if (expanded) void load()
  }, [expanded, version, load])

  const toggle = (): void => {
    if (entry.isDir) setExpanded((e) => !e)
    else onOpenFile(entry)
  }

  return (
    <div>
      <div
        onClick={toggle}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-ultra-path', entry.path)
          e.dataTransfer.setData('text/plain', entry.path)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        style={{ paddingLeft: depth * 12 + 8 }}
        className="group/row flex cursor-pointer items-center gap-1 rounded-sm py-1 pr-1 text-sm hover:bg-secondary/60"
      >
        {entry.isDir ? (
          <>
            <ChevronRight
              className={cn('h-3.5 w-3.5 shrink-0 transition-transform', expanded && 'rotate-90')}
            />
            {expanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>

        <div
          className="flex shrink-0 items-center opacity-0 transition group-hover/row:opacity-100 data-[open=true]:opacity-100"
          data-open={menuOpen}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            title="Send to agent"
            onClick={() => onSend(entry)}
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                title="More"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => window.api.fs.reveal(entry.path)}>
                <RevealIcon className="h-4 w-4" />
                Open in Finder
              </DropdownMenuItem>
              {!entry.isDir && (
                <DropdownMenuItem onSelect={() => onEdit(entry)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  if (window.confirm(`Move "${entry.name}" to the Trash?`)) {
                    void window.api.fs.trash(entry.path)
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {entry.isDir && expanded && (
        <div>
          {loading && !children && (
            <div style={{ paddingLeft: (depth + 1) * 12 + 22 }} className="py-1 text-xs text-muted-foreground">
              loading…
            </div>
          )}
          {children?.map((c) => (
            <TreeNode
              key={c.path}
              entry={c}
              depth={depth + 1}
              version={version}
              onOpenFile={onOpenFile}
              onSend={onSend}
              onEdit={onEdit}
            />
          ))}
          {children?.length === 0 && (
            <div style={{ paddingLeft: (depth + 1) * 12 + 22 }} className="py-1 text-xs text-muted-foreground">
              empty
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  root: string
  onOpenFile: (entry: DirEntry) => void
  onSend: (entry: DirEntry) => void
  onEdit: (entry: DirEntry) => void
}

export default function FileTree({ root, onOpenFile, onSend, onEdit }: Props): JSX.Element {
  const [entries, setEntries] = useState<DirEntry[] | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let live = true
    window.api.fs.listDir(root).then((e) => live && setEntries(e)).catch(() => live && setEntries([]))
    window.api.fs.watch(root)
    const off = window.api.fs.onChanged((changed) => {
      if (changed === root) {
        window.api.fs.listDir(root).then((e) => setEntries(e)).catch(() => {})
        setVersion((v) => v + 1)
      }
    })
    return () => {
      live = false
      off()
      window.api.fs.unwatch(root)
    }
  }, [root])

  if (!entries) return <div className="p-4 text-xs text-muted-foreground">loading…</div>

  return (
    <div className="py-1">
      {entries.map((e) => (
        <TreeNode
          key={e.path}
          entry={e}
          depth={0}
          version={version}
          onOpenFile={onOpenFile}
          onSend={onSend}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}

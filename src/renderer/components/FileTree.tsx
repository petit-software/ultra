import { useEffect, useState, useCallback } from 'react'
import { ChevronRight, File as FileIcon, Folder, FolderOpen } from 'lucide-react'
import type { DirEntry } from '../types'
import { cn } from '@/lib/utils'

interface NodeProps {
  entry: DirEntry
  depth: number
  version: number
  onOpenFile: (entry: DirEntry) => void
}

function TreeNode({ entry, depth, version, onOpenFile }: NodeProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<DirEntry[] | null>(null)
  const [loading, setLoading] = useState(false)

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
        draggable={!entry.isDir}
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-ultra-path', entry.path)
          e.dataTransfer.setData('text/plain', entry.path)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        style={{ paddingLeft: depth * 12 + 8 }}
        className="flex cursor-pointer items-center gap-1 rounded-sm py-1 pr-2 text-sm hover:bg-secondary/60"
      >
        {entry.isDir ? (
          <>
            <ChevronRight
              className={cn('h-3.5 w-3.5 shrink-0 transition-transform', expanded && 'rotate-90')}
            />
            {expanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary/80" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-primary/80" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate">{entry.name}</span>
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
}

export default function FileTree({ root, onOpenFile }: Props): JSX.Element {
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
        <TreeNode key={e.path} entry={e} depth={0} version={version} onOpenFile={onOpenFile} />
      ))}
    </div>
  )
}

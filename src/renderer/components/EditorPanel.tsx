import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Check, RotateCcw, ArrowUpRight } from 'lucide-react'
import PaneHeader from './PaneHeader'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useStore } from '../store/useStore'

type Loaded =
  | { kind: 'text'; content: string }
  | { kind: 'readonly'; reason: string }
  | { kind: 'error'; reason: string }

export default function EditorPanel(): JSX.Element {
  const activeFile = useStore((s) => s.activeFile)
  const closeFile = useStore((s) => s.closeFile)
  const editorCommand = useStore((s) => s.editorCommand)

  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const path = activeFile?.path ?? null
  const dirty = loaded?.kind === 'text' && draft !== loaded.content

  const lineCount = useMemo(() => (draft ? draft.split('\n').length : 1), [draft])

  // Keep the line-number gutter vertically aligned with the textarea's scroll.
  const syncScroll = (): void => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  // Load the file whenever the active file changes.
  useEffect(() => {
    if (!path) {
      setLoaded(null)
      setDraft('')
      return
    }
    let live = true
    setLoaded(null)
    window.api.fs
      .readFile(path)
      .then((res) => {
        if (!live) return
        if (res.tooLarge) {
          setLoaded({ kind: 'readonly', reason: 'Binary or file too large to edit here.' })
        } else {
          setLoaded({ kind: 'text', content: res.content })
          setDraft(res.content)
        }
      })
      .catch(() => live && setLoaded({ kind: 'error', reason: 'Could not read this file.' }))
    return () => {
      live = false
    }
  }, [path])

  const save = async (): Promise<void> => {
    if (!path || loaded?.kind !== 'text' || !dirty || saving) return
    setSaving(true)
    const ok = await window.api.fs.writeFile(path, draft)
    setSaving(false)
    if (ok) setLoaded({ kind: 'text', content: draft })
    else window.alert('Could not save this file.')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      void save()
    }
  }

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader
        title="Editor"
        titleContent={
          activeFile && (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-xs text-foreground/80">{activeFile.name}</span>
              {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" title="Unsaved changes" />}
            </div>
          )
        }
      >
        {activeFile && (
          <>
            {dirty && loaded?.kind === 'text' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setDraft(loaded.content)}
                  >
                    <RotateCcw />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Revert changes</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={!dirty || saving}
                  onClick={() => void save()}
                >
                  <Check />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save (⌘S)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => void window.api.editor.open(editorCommand, activeFile.path)}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in external editor</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={closeFile}>
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </>
        )}
      </PaneHeader>

      <div className="min-h-0 flex-1">
        {!activeFile ? (
          <div className="space-y-1 p-4 text-sm text-muted-foreground">
            <p>No file open.</p>
            <p>Click a file in the Files panel to preview and edit it here.</p>
          </div>
        ) : loaded === null ? (
          <div className="p-4 text-xs text-muted-foreground">loading…</div>
        ) : loaded.kind === 'text' ? (
          <div className="flex h-full font-mono text-xs leading-relaxed">
            <div
              ref={gutterRef}
              aria-hidden
              className="select-none overflow-hidden py-3 pl-3 pr-2 text-right text-muted-foreground/50"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              spellCheck={false}
              wrap="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onScroll={syncScroll}
              className="h-full w-full resize-none whitespace-pre bg-transparent py-3 pl-1 pr-3 text-foreground outline-none"
            />
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">{loaded.reason}</div>
        )}
      </div>
    </div>
  )
}

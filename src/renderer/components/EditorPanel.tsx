import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Check, RotateCcw, ArrowUpRight, Eye, Pencil } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import PaneHeader from './PaneHeader'
import PaneFooter from './PaneFooter'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useStore } from '../store/useStore'

type Loaded =
  | { kind: 'text'; content: string }
  | { kind: 'readonly'; reason: string }
  | { kind: 'error'; reason: string }

const isMarkdown = (name: string): boolean => /\.(md|markdown|mdx)$/i.test(name)

export default function EditorPanel(): JSX.Element {
  const activeFile = useStore((s) => s.activeFile)
  const closeFile = useStore((s) => s.closeFile)
  const editorCommand = useStore((s) => s.editorCommand)
  const editorFontSize = useStore((s) => s.editorFontSize)

  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const path = activeFile?.path ?? null
  const dirty = loaded?.kind === 'text' && draft !== loaded.content
  const markdown = !!activeFile && isMarkdown(activeFile.name)
  // Markdown opens as a rendered preview; the header toggle switches to editing.
  const [preview, setPreview] = useState(false)

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
    setPreview(isMarkdown(path))
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
      <PaneHeader title="Editor">
        {activeFile && (
          <>
            {markdown && loaded?.kind === 'text' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setPreview((p) => !p)}
                  >
                    {preview ? <Pencil /> : <Eye />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{preview ? 'Edit source' : 'Preview'}</TooltipContent>
              </Tooltip>
            )}
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
        ) : loaded.kind === 'text' && markdown && preview ? (
          <div className="prose prose-sm dark:prose-invert h-full max-w-none overflow-auto px-4 py-3">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Keep navigation out of the app window; http(s) links open in the browser.
                a: ({ href, children }) => (
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault()
                      if (href) window.api.app.openExternal(href)
                    }}
                  >
                    {children}
                  </a>
                )
              }}
            >
              {draft}
            </ReactMarkdown>
          </div>
        ) : loaded.kind === 'text' ? (
          <div
            className="flex h-full font-mono leading-relaxed"
            style={{ fontSize: editorFontSize }}
          >
            <div
              ref={gutterRef}
              aria-hidden
              className="select-none overflow-hidden pb-3 pl-3 pr-2 text-right text-muted-foreground/50"
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
              className="h-full w-full resize-none whitespace-pre bg-transparent pb-3 pl-1 pr-3 text-foreground outline-none"
            />
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">{loaded.reason}</div>
        )}
      </div>

      {activeFile && (
        <PaneFooter>
          <span className="truncate">{activeFile.name}</span>
          {dirty && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              title="Unsaved changes"
            />
          )}
          <button
            type="button"
            title="Close file"
            onClick={closeFile}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </PaneFooter>
      )}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Check, RotateCcw, ArrowUpRight, Eye, Pencil, Search, ChevronUp, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import PaneHeader from './PaneHeader'
import PaneFooter from './PaneFooter'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useStore } from '../store/useStore'
import { cn } from '@/lib/utils'

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
  const focusedPanel = useStore((s) => s.focusedPanel)

  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Find-in-file state: the bar, the needle, and which match is selected.
  const [findOpen, setFindOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeMatch, setActiveMatch] = useState(0)
  const findInputRef = useRef<HTMLInputElement>(null)

  const path = activeFile?.path ?? null
  const dirty = loaded?.kind === 'text' && draft !== loaded.content
  const markdown = !!activeFile && isMarkdown(activeFile.name)
  // Markdown opens as a rendered preview; the header toggle switches to editing.
  const [preview, setPreview] = useState(false)

  const lineCount = useMemo(() => (draft ? draft.split('\n').length : 1), [draft])

  // Case-insensitive start index of every occurrence of the query in the draft.
  const matches = useMemo(() => {
    if (!query || loaded?.kind !== 'text') return []
    const hay = draft.toLowerCase()
    const needle = query.toLowerCase()
    const out: number[] = []
    for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length))
      out.push(i)
    return out
  }, [query, draft, loaded])

  // Keep the line-number gutter and highlight backdrop aligned with the
  // textarea's scroll — the backdrop mirrors the text so its marks line up.
  const syncScroll = (): void => {
    const ta = textareaRef.current
    if (!ta) return
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop
    if (backdropRef.current) {
      backdropRef.current.scrollTop = ta.scrollTop
      backdropRef.current.scrollLeft = ta.scrollLeft
    }
  }

  // Backdrop content: the draft with every match wrapped in a highlight span
  // (the active one stronger). Text is transparent — the textarea's real text
  // sits on top, so the marks read as highlights behind the characters.
  const highlightNodes = useMemo(() => {
    if (!findOpen || !matches.length) return null
    const nodes: React.ReactNode[] = []
    let last = 0
    matches.forEach((start, i) => {
      if (start > last) nodes.push(draft.slice(last, start))
      nodes.push(
        <mark
          key={i}
          className={cn(
            'rounded-[2px] text-transparent',
            i === activeMatch ? 'bg-amber-400/70' : 'bg-primary/30'
          )}
        >
          {draft.slice(start, start + query.length)}
        </mark>
      )
      last = start + query.length
    })
    nodes.push(draft.slice(last))
    return nodes
  }, [findOpen, matches, draft, query, activeMatch])

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

  // Select a match in the textarea (which scrolls it into view) and bounce focus
  // back to the find field so it keeps the keyboard; Chrome leaves the selection
  // visible on the blurred textarea, so the hit stays highlighted while typing.
  const goToMatch = useCallback(
    (idx: number) => {
      const ta = textareaRef.current
      const start = matches[idx]
      if (!ta || start == null) return
      // Selecting the range scrolls the textarea to it; keep gutter + backdrop
      // aligned, then hand the keyboard back to the find field.
      ta.focus()
      ta.setSelectionRange(start, start + query.length)
      if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop
      if (backdropRef.current) {
        backdropRef.current.scrollTop = ta.scrollTop
        backdropRef.current.scrollLeft = ta.scrollLeft
      }
      findInputRef.current?.focus()
    },
    [matches, query]
  )

  const openFind = (): void => {
    if (!activeFile) return
    if (markdown && preview) setPreview(false)
    setFindOpen(true)
    requestAnimationFrame(() => {
      findInputRef.current?.focus()
      findInputRef.current?.select()
    })
  }

  const closeFind = (): void => {
    setFindOpen(false)
    textareaRef.current?.focus()
  }

  // Wrap-around move to the next/previous match. Before the first navigation
  // (activeMatch < 0) all hits are highlighted but none selected, so the first
  // Enter lands on the first match and Shift+Enter on the last.
  const step = (dir: 1 | -1): void => {
    if (!matches.length) return
    const base = activeMatch < 0 ? (dir === 1 ? -1 : 0) : activeMatch
    const i = (base + dir + matches.length) % matches.length
    setActiveMatch(i)
    goToMatch(i)
  }

  // ⌘/Ctrl+F opens the find bar whenever the editor panel is the focused one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'f') return
      if (focusedPanel !== 'editor' || !activeFile) return
      e.preventDefault()
      if (markdown && preview) setPreview(false)
      setFindOpen(true)
      requestAnimationFrame(() => {
        findInputRef.current?.focus()
        findInputRef.current?.select()
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusedPanel, activeFile, markdown, preview])

  // A fresh query highlights every hit but selects none — the scroll-to happens
  // on Enter, not while typing, so the view stays put until asked to move.
  useEffect(() => {
    setActiveMatch(-1)
  }, [query])

  // Reset the find bar whenever the open file changes.
  useEffect(() => {
    setFindOpen(false)
    setQuery('')
  }, [path])

  return (
    <div className="group/section flex h-full flex-col">
      <PaneHeader title="Editor">
        {activeFile && (
          <>
            {loaded?.kind === 'text' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => (findOpen ? closeFind() : openFind())}
                  >
                    <Search />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Find in file (⌘F)</TooltipContent>
              </Tooltip>
            )}
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

      <div className="relative min-h-0 flex-1">
        {!activeFile ? (
          <div className="space-y-1 p-2 text-sm text-muted-foreground">
            <p>No file open.</p>
            <p>Click a file in the Files panel to preview and edit it here.</p>
          </div>
        ) : loaded === null ? (
          <div className="p-2 text-xs text-muted-foreground">loading…</div>
        ) : loaded.kind === 'text' && markdown && preview ? (
          <div
            className="prose prose-sm dark:prose-invert h-full max-w-none overflow-auto px-2 py-2"
            style={{ fontSize: editorFontSize }}
          >
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
            <div className="relative min-w-0 flex-1">
              {/* Highlight backdrop: same metrics as the textarea, scrolled in
                  lockstep, so its marks sit exactly behind the matched text. */}
              {highlightNodes && (
                <div
                  ref={backdropRef}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre pb-3 pl-1 pr-3 text-transparent"
                >
                  {highlightNodes}
                </div>
              )}
              <textarea
                ref={textareaRef}
                spellCheck={false}
                wrap="off"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                onScroll={syncScroll}
                className="relative h-full w-full resize-none whitespace-pre bg-transparent pb-3 pl-1 pr-3 text-foreground outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="p-2 text-sm text-muted-foreground">{loaded.reason}</div>
        )}
      </div>

      {/* Find bar, pinned to the bottom of the panel above the footer. */}
      {findOpen && loaded?.kind === 'text' && !(markdown && preview) && (
        <div className="flex flex-none items-center gap-2 border-t border-border/75 px-3 py-1.5">
          <input
            ref={findInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                closeFind()
              } else if (e.key === 'Enter') {
                e.preventDefault()
                step(e.shiftKey ? -1 : 1)
              }
            }}
            placeholder="Find in file"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {matches.length
              ? `${activeMatch < 0 ? matches.length : `${activeMatch + 1}/${matches.length}`}${activeMatch < 0 ? ' found' : ''}`
              : query
                ? 'No results'
                : ''}
          </span>
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!matches.length}
            title="Previous match (⇧⏎)"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!matches.length}
            title="Next match (⏎)"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={closeFind}
            title="Close (Esc)"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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

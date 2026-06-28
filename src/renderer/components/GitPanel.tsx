import { useCallback, useEffect, useState } from 'react'
import {
  GitBranch,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Plus,
  Minus,
  Undo2,
  Check,
  ChevronDown,
  History
} from 'lucide-react'
import PaneHeader from './PaneHeader'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useStore } from '../store/useStore'
import type { GitStatus, GitFile, GitCommit } from '../types'
import { cn } from '@/lib/utils'

const base = (p: string): string => p.split('/').pop() || p
const isStaged = (f: GitFile): boolean => f.x !== ' ' && f.x !== '?'
const isUnstaged = (f: GitFile): boolean => f.y !== ' '
const isUntracked = (f: GitFile): boolean => f.x === '?' && f.y === '?'

function badge(code: string): string {
  switch (code) {
    case 'M':
      return 'M'
    case 'A':
      return 'A'
    case 'D':
      return 'D'
    case 'R':
      return 'R'
    case 'C':
      return 'C'
    case '?':
      return 'U'
    default:
      return code.trim() || '•'
  }
}

function DiffView({ text }: { text: string }): JSX.Element {
  return (
    <pre className="overflow-auto p-1 font-mono text-xs leading-relaxed">
      {text.split('\n').map((line, i) => {
        let cls = 'text-muted-foreground'
        if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-emerald-500'
        else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-red-500'
        else if (line.startsWith('@@')) cls = 'text-primary'
        else if (line.startsWith('diff ') || line.startsWith('index ')) cls = 'text-muted-foreground/60'
        return (
          <div key={i} className={cls}>
            {line || ' '}
          </div>
        )
      })}
    </pre>
  )
}

export default function GitPanel(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const projects = useStore((s) => s.projects)
  const activeSessionId = useStore((s) => s.activeSessionId)

  const activeSession = activeSessionId ? sessions[activeSessionId] : null
  const project = activeSession
    ? projects.find((p) => p.id === activeSession.projectId)
    : projects[0]
  const cwd = project?.path || ''

  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branchList, setBranchList] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [diff, setDiff] = useState<{ title: string; text: string } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [logEntries, setLogEntries] = useState<GitCommit[]>([])

  const refresh = useCallback(async () => {
    if (!cwd) {
      setStatus(null)
      return
    }
    const st = (await window.api.git.status(cwd)) as GitStatus
    setStatus(st)
    if (st.isRepo) {
      const b = (await window.api.git.branches(cwd)) as { current: string; all: string[] }
      setBranchList(b.all)
    }
  }, [cwd])

  useEffect(() => {
    void refresh()
    if (!cwd) return
    const off = window.api.fs.onChanged((root) => {
      if (root === cwd) void refresh()
    })
    return off
  }, [cwd, refresh])

  useEffect(() => {
    if (showHistory && cwd) {
      window.api.git.log(cwd).then((l) => setLogEntries(l as GitCommit[]))
    }
  }, [showHistory, cwd, status])

  const act = async (fn: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  const openDiff = async (f: GitFile, staged: boolean): Promise<void> => {
    const text = (await window.api.git.diff(cwd, f.path, staged)) as string
    setDiff({ title: `${staged ? 'Staged: ' : ''}${f.path}`, text: text || '(no diff)' })
  }

  // --- render states -------------------------------------------------------

  if (!project || !cwd) {
    return (
      <div className="flex h-full flex-col">
        <PaneHeader title="Git" />
        <div className="p-4 text-xs text-muted-foreground">Open a project to use Git.</div>
      </div>
    )
  }

  if (status && !status.isRepo) {
    return (
      <div className="flex h-full flex-col">
        <PaneHeader title="Git" />
        <div className="space-y-3 p-4 text-xs text-muted-foreground">
          <p>No git repository in this project.</p>
          <Button size="sm" disabled={busy} onClick={() => void act(() => window.api.git.init(cwd))}>
            <GitBranch className="h-4 w-4" />
            Initialize Repository
          </Button>
        </div>
      </div>
    )
  }

  const staged = (status?.files ?? []).filter(isStaged)
  const changes = (status?.files ?? []).filter((f) => isUnstaged(f))

  return (
    <div className="flex h-full flex-col">
      <PaneHeader title="Git">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => void refresh()}>
              <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </PaneHeader>

      {/* Branch + remote actions */}
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 min-w-0 gap-1.5 px-1.5">
              <GitBranch className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-xs">{status?.branch ?? '…'}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-auto">
            <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
            {branchList.map((b) => (
              <DropdownMenuItem
                key={b}
                onSelect={() => void act(() => window.api.git.switchBranch(cwd, b))}
              >
                <GitBranch className="h-3.5 w-3.5" />
                {b}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                const name = window.prompt('New branch name')
                if (name) void act(() => window.api.git.createBranch(cwd, name.trim()))
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Create branch…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {status && (status.ahead > 0 || status.behind > 0) && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {status.ahead > 0 && (
              <span className="flex items-center">
                <ArrowUp className="h-3 w-3" />
                {status.ahead}
              </span>
            )}
            {status.behind > 0 && (
              <span className="flex items-center">
                <ArrowDown className="h-3 w-3" />
                {status.behind}
              </span>
            )}
          </span>
        )}

        <div className="ml-auto flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={busy} onClick={() => void act(() => window.api.git.fetch(cwd))}>
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fetch</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={busy} onClick={() => void act(() => window.api.git.pull(cwd))}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pull</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={busy} onClick={() => void act(() => window.api.git.push(cwd))}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Push</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Commit box */}
      <div className="flex flex-none gap-2 border-b border-border p-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            staged.length
              ? `Commit message (${staged.length} staged)`
              : 'Stage files to commit, then write a message'
          }
          rows={2}
          className="min-h-0 resize-none text-xs"
        />
        <Button
          size="icon"
          className="h-auto"
          title="Commit staged"
          disabled={busy || !message.trim() || staged.length === 0}
          onClick={() =>
            void act(async () => {
              const res = (await window.api.git.commit(cwd, message.trim())) as {
                ok: boolean
                stderr: string
              }
              if (res.ok) setMessage('')
              else window.alert(res.stderr || 'Commit failed')
            })
          }
        >
          <Check />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Section
          title="Staged"
          count={staged.length}
          action={
            staged.length > 0 ? (
              <button
                className="text-muted-foreground hover:text-foreground"
                title="Unstage all"
                onClick={() => void act(() => window.api.git.unstage(cwd, '.'))}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            ) : null
          }
        >
          {staged.map((f) => (
            <FileRow
              key={'s' + f.path}
              file={f}
              onOpen={() => void openDiff(f, true)}
              actions={
                <button
                  title="Unstage"
                  onClick={() => void act(() => window.api.git.unstage(cwd, f.path))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              }
            />
          ))}
        </Section>

        <Section
          title="Changes"
          count={changes.length}
          action={
            changes.length > 0 ? (
              <button
                className="text-muted-foreground hover:text-foreground"
                title="Stage all"
                onClick={() => void act(() => window.api.git.stageAll(cwd))}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            ) : null
          }
        >
          {changes.map((f) => (
            <FileRow
              key={'c' + f.path}
              file={f}
              onOpen={() => void openDiff(f, false)}
              actions={
                <>
                  <button
                    title="Discard"
                    onClick={() => {
                      if (window.confirm(`Discard changes to ${base(f.path)}?`))
                        void act(() => window.api.git.discard(cwd, f.path, isUntracked(f)))
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    title="Stage"
                    onClick={() => void act(() => window.api.git.stage(cwd, f.path))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </>
              }
            />
          ))}
        </Section>

        {staged.length === 0 && changes.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground">No changes. Working tree clean.</div>
        )}

        {/* History */}
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <History className="h-3.5 w-3.5" />
          History
          <ChevronDown className={cn('ml-auto h-3.5 w-3.5 transition', showHistory && 'rotate-180')} />
        </button>
        {showHistory && (
          <ul className="pb-2">
            {logEntries.map((c) => (
              <li key={c.hash} className="px-3 py-1 text-xs">
                <div className="flex items-center gap-2">
                  <code className="text-primary">{c.hash}</code>
                  <span className="truncate">{c.subject}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {c.author} · {c.relative}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!diff} onOpenChange={(o) => !o && setDiff(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate font-mono text-xs">{diff?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] min-h-0 flex-1">
            <DiffView text={diff?.text ?? ''} />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Section({
  title,
  count,
  action,
  children
}: {
  title: string
  count: number
  action: React.ReactNode
  children: React.ReactNode
}): JSX.Element | null {
  if (count === 0) return null
  return (
    <div>
      <div className="flex items-center justify-between px-3 pb-0.5 pt-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title} · {count}
        </span>
        {action}
      </div>
      <ul className="px-1.5">{children}</ul>
    </div>
  )
}

function FileRow({
  file,
  onOpen,
  actions
}: {
  file: GitFile
  onOpen: () => void
  actions: React.ReactNode
}): JSX.Element {
  const code = isStaged(file) ? file.x : file.y
  const color =
    code === 'M' ? 'text-amber-500' : code === '?' ? 'text-emerald-500' : code === 'D' ? 'text-red-500' : 'text-primary'
  return (
    <li
      onClick={onOpen}
      className="group/grow flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary/60"
      title={file.path}
    >
      <span className="min-w-0 flex-1 truncate">{base(file.path)}</span>
      <span
        className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover/grow:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {actions}
      </span>
      <span className={cn('w-3 shrink-0 text-center font-mono text-xs', color)}>{badge(code)}</span>
    </li>
  )
}

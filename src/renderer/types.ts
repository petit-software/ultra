export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

export interface GitFileStats {
  added: number | null
  removed: number | null
}

export interface GitFile {
  path: string
  x: string
  y: string
  stagedStats?: GitFileStats
  worktreeStats?: GitFileStats
}

export interface GitStatus {
  isRepo: boolean
  branch: string | null
  ahead: number
  behind: number
  hasUpstream: boolean
  files: GitFile[]
}

export interface GitCommit {
  hash: string
  subject: string
  author: string
  relative: string
}

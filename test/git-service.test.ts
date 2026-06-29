import { describe, it, expect } from 'vitest'
import { parseStatus } from '../src/main/git-service'

// Build the NUL-separated `git status --porcelain=v1 -b -z` payload.
const z = (...entries: string[]): string => entries.map((e) => e + '\0').join('')

describe('parseStatus', () => {
  it('reads a plain branch with no upstream and no changes', () => {
    const s = parseStatus(z('## main'))
    expect(s.branch).toBe('main')
    expect(s.hasUpstream).toBe(false)
    expect(s.ahead).toBe(0)
    expect(s.behind).toBe(0)
    expect(s.files).toEqual([])
  })

  it('reads upstream with ahead/behind counts', () => {
    const s = parseStatus(z('## main...origin/main [ahead 2, behind 3]'))
    expect(s.branch).toBe('main')
    expect(s.hasUpstream).toBe(true)
    expect(s.ahead).toBe(2)
    expect(s.behind).toBe(3)
  })

  it('classifies staged, unstaged, both, and untracked files', () => {
    const s = parseStatus(z('## main', 'M  a.ts', ' M b.ts', 'MM c.ts', '?? d.ts'))
    expect(s.files).toEqual([
      { path: 'a.ts', x: 'M', y: ' ' },
      { path: 'b.ts', x: ' ', y: 'M' },
      { path: 'c.ts', x: 'M', y: 'M' },
      { path: 'd.ts', x: '?', y: '?' }
    ])
  })

  it('handles a detached HEAD', () => {
    const s = parseStatus(z('## HEAD (no branch)'))
    expect(s.branch).toBe('HEAD (detached)')
    expect(s.hasUpstream).toBe(false)
  })

  it('consumes the original path token of a rename entry', () => {
    const s = parseStatus(z('## main', 'R  new.ts', 'old.ts', ' M after.ts'))
    expect(s.files).toEqual([
      { path: 'new.ts', x: 'R', y: ' ' },
      { path: 'after.ts', x: ' ', y: 'M' }
    ])
  })

  it('handles paths containing spaces', () => {
    const s = parseStatus(z('## main', ' M my file.ts'))
    expect(s.files).toEqual([{ path: 'my file.ts', x: ' ', y: 'M' }])
  })
})

import { describe, it, expect } from 'vitest'
import { parseNumstat, parseStatus } from '../src/main/git-service'

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

describe('parseNumstat', () => {
  it('reads added/removed counts per file', () => {
    const m = parseNumstat(z('12\t4\ta.ts', '0\t7\tb.ts'))
    expect(m.get('a.ts')).toEqual({ added: 12, removed: 4 })
    expect(m.get('b.ts')).toEqual({ added: 0, removed: 7 })
  })

  it('keeps binary file counts as null', () => {
    const m = parseNumstat(z('-\t-\timg.png'))
    expect(m.get('img.png')).toEqual({ added: null, removed: null })
  })

  it('handles empty output', () => {
    expect(parseNumstat('').size).toBe(0)
  })

  it('uses the post-image path of a rename entry', () => {
    const m = parseNumstat(z('3\t1\t', 'old.ts', 'new.ts', '5\t0\tafter.ts'))
    expect(m.get('new.ts')).toEqual({ added: 3, removed: 1 })
    expect(m.get('after.ts')).toEqual({ added: 5, removed: 0 })
    expect(m.has('old.ts')).toBe(false)
  })

  it('handles paths containing spaces', () => {
    const m = parseNumstat(z('1\t2\tmy file.ts'))
    expect(m.get('my file.ts')).toEqual({ added: 1, removed: 2 })
  })
})

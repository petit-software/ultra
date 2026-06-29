import { describe, it, expect } from 'vitest'
import { relTo, basename } from '../src/renderer/lib/paths'

describe('relTo', () => {
  it('returns the path relative to root', () => {
    expect(relTo('/a/b', '/a/b/c.ts')).toBe('c.ts')
    expect(relTo('/a/b', '/a/b/sub/c.ts')).toBe('sub/c.ts')
  })

  it('ignores a trailing slash on root', () => {
    expect(relTo('/a/b/', '/a/b/c.ts')).toBe('c.ts')
  })

  it('returns the absolute path when outside root', () => {
    expect(relTo('/a/b', '/x/y.ts')).toBe('/x/y.ts')
  })

  it('does not treat a sibling prefix as a child', () => {
    // "/a/bc.ts" starts with "/a/b" but is not inside "/a/b/"
    expect(relTo('/a/b', '/a/bc.ts')).toBe('/a/bc.ts')
  })

  it('returns the path unchanged when root is empty', () => {
    expect(relTo('', '/a.ts')).toBe('/a.ts')
  })
})

describe('basename', () => {
  it('returns the last segment', () => {
    expect(basename('/a/b/c.ts')).toBe('c.ts')
    expect(basename('file.ts')).toBe('file.ts')
  })

  it('ignores trailing slashes', () => {
    expect(basename('/a/b/')).toBe('b')
  })
})

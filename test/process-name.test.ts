import { describe, expect, it } from 'vitest'
import {
  foregroundCommandFromPs,
  foregroundLabel,
  isGenericInterpreter
} from '../src/main/process-name'

describe('isGenericInterpreter', () => {
  it('matches interpreters regardless of case and .exe suffix', () => {
    expect(isGenericInterpreter('node')).toBe(true)
    expect(isGenericInterpreter('node.exe')).toBe(true)
    expect(isGenericInterpreter('Python3')).toBe(true)
    expect(isGenericInterpreter('claude')).toBe(false)
    expect(isGenericInterpreter('codex')).toBe(false)
  })
})

describe('foregroundLabel', () => {
  it('resolves interpreter commands to the script they run', () => {
    expect(foregroundLabel('node /opt/homebrew/bin/gemini --yolo', 'node')).toBe('gemini')
    expect(foregroundLabel('node /usr/local/lib/node_modules/claude/cli.js', 'node')).toBe('cli')
    expect(foregroundLabel('node /Users/x/.local/bin/claude.js chat', 'node')).toBe('claude')
    expect(foregroundLabel('python3 /usr/local/bin/aider --model gpt', 'python3')).toBe('aider')
  })

  it('keeps non-interpreter commands as their basename', () => {
    expect(foregroundLabel('/opt/homebrew/bin/claude --continue', 'node')).toBe('claude')
    expect(foregroundLabel('vim notes.md', 'vim')).toBe('vim')
  })

  it('falls back when nothing better is found', () => {
    expect(foregroundLabel('node -e console.log(1)', 'node')).toBe('console.log(1)')
    expect(foregroundLabel('node', 'node')).toBe('node')
    expect(foregroundLabel('', 'node')).toBe('node')
  })
})

describe('foregroundCommandFromPs', () => {
  const ps = [
    'Ss     -zsh',
    'S+     node /opt/homebrew/bin/gemini',
    'S      /usr/sbin/distnoted agent'
  ].join('\n')

  it('picks the foreground (+) row, skipping the login shell', () => {
    expect(foregroundCommandFromPs(ps, 'zsh')).toBe('node /opt/homebrew/bin/gemini')
  })

  it('skips a foreground login shell so idle sessions resolve to nothing', () => {
    expect(foregroundCommandFromPs('Ss+    -zsh', 'zsh')).toBeNull()
    expect(foregroundCommandFromPs('', 'zsh')).toBeNull()
  })

  it('prefers the last foreground row (the pipeline tail)', () => {
    const pipeline = ['S+     node /x/bin/gemini', 'S+     head -c 100'].join('\n')
    expect(foregroundCommandFromPs(pipeline, 'zsh')).toBe('head -c 100')
  })
})

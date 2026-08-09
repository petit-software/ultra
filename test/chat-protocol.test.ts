import { describe, it, expect } from 'vitest'
import {
  parseClaudeStreamLine,
  parseCodexExecLine,
  parseCodexModels
} from '../src/main/chat-protocol'

const line = (obj: unknown): string => JSON.stringify(obj)

describe('parseClaudeStreamLine', () => {
  it('reports the session id and resolved model from the init event', () => {
    expect(
      parseClaudeStreamLine(line({ type: 'system', subtype: 'init', session_id: 'sess-1' }))
    ).toEqual([{ kind: 'session', text: 'sess-1' }])
    expect(
      parseClaudeStreamLine(
        line({ type: 'system', subtype: 'init', session_id: 'sess-1', model: 'claude-sonnet-5' })
      )
    ).toEqual([
      { kind: 'session', text: 'sess-1' },
      { kind: 'model', text: 'claude-sonnet-5' }
    ])
  })

  it('parses assistant text and tool calls, skipping thinking blocks', () => {
    const events = parseClaudeStreamLine(
      line({
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'hmm' },
            { type: 'text', text: 'On it.' },
            { type: 'tool_use', name: 'Write', input: { file_path: '/tmp/a.txt' } }
          ]
        }
      })
    )
    expect(events).toEqual([
      { kind: 'assistant', text: 'On it.' },
      { kind: 'tool', tool: 'Write', text: '/tmp/a.txt' }
    ])
  })

  it('renders mcp tool names as server.tool', () => {
    const events = parseClaudeStreamLine(
      line({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'mcp__figma__get_file', input: { url: 'https://x' } },
            { type: 'tool_use', name: 'Read', input: { file_path: '/a' } }
          ]
        }
      })
    )
    expect(events.map((e) => e.tool)).toEqual(['figma.get_file', 'Read'])
  })

  it('ends the turn on result, surfacing failures as an error row', () => {
    expect(parseClaudeStreamLine(line({ type: 'result', is_error: false }))).toEqual([
      { kind: 'turn-end', text: '' }
    ])
    expect(
      parseClaudeStreamLine(line({ type: 'result', is_error: true, result: 'Tool denied' }))
    ).toEqual([
      { kind: 'error', text: 'Tool denied' },
      { kind: 'turn-end', text: '' }
    ])
  })

  it('surfaces a rejected rate limit', () => {
    const events = parseClaudeStreamLine(
      line({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected' } })
    )
    expect(events[0]).toMatchObject({ kind: 'error' })
    expect(events[0].text).toMatch(/rate limit/i)
    expect(
      parseClaudeStreamLine(
        line({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } })
      )
    ).toEqual([])
  })

  it('ignores tool results, unknown types, and malformed lines', () => {
    expect(parseClaudeStreamLine(line({ type: 'user', message: { content: [] } }))).toEqual([])
    expect(parseClaudeStreamLine(line({ type: 'stream_event' }))).toEqual([])
    expect(parseClaudeStreamLine('{oops')).toEqual([])
    expect(parseClaudeStreamLine('null')).toEqual([])
    expect(parseClaudeStreamLine('')).toEqual([])
  })
})

describe('parseCodexModels', () => {
  it('collects slug + display_name pairs from the models cache', () => {
    const cache = {
      fetched_at: '2026-08-09T10:38:31Z',
      models: [
        { slug: 'gpt-5.6-sol', display_name: 'GPT-5.6-Sol', description: 'Latest' },
        { slug: 'gpt-5.5', display_name: 'GPT-5.5' }
      ]
    }
    expect(parseCodexModels(cache)).toEqual([
      { id: 'gpt-5.6-sol', label: 'GPT-5.6-Sol' },
      { id: 'gpt-5.5', label: 'GPT-5.5' }
    ])
  })

  it('finds models however deeply they are nested, without duplicates', () => {
    const cache = {
      groups: [{ items: [{ slug: 'a', display_name: 'A' }, { nested: { slug: 'b', display_name: 'B' } }] }],
      recent: [{ slug: 'a', display_name: 'A' }]
    }
    expect(parseCodexModels(cache)).toEqual([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' }
    ])
  })

  it('returns nothing for junk, so the caller can fall back', () => {
    expect(parseCodexModels(null)).toEqual([])
    expect(parseCodexModels({ models: [{ name: 'no slug' }] })).toEqual([])
  })
})

describe('parseCodexExecLine', () => {
  it('reports the thread id so turns can resume', () => {
    expect(parseCodexExecLine(line({ type: 'thread.started', thread_id: 'th-1' }))).toEqual([
      { kind: 'session', text: 'th-1' }
    ])
  })

  it('parses agent messages', () => {
    expect(
      parseCodexExecLine(
        line({ type: 'item.completed', item: { id: 'i0', type: 'agent_message', text: 'Done.' } })
      )
    ).toEqual([{ kind: 'assistant', text: 'Done.' }])
  })

  it('unwraps the shell wrapper from executed commands', () => {
    expect(
      parseCodexExecLine(
        line({
          type: 'item.completed',
          item: {
            type: 'command_execution',
            command: "/bin/zsh -lc 'echo hi'",
            exit_code: 0,
            status: 'completed'
          }
        })
      )
    ).toEqual([{ kind: 'tool', tool: 'Run', text: 'echo hi' }])
    // A bare command is passed through untouched.
    expect(
      parseCodexExecLine(
        line({ type: 'item.completed', item: { type: 'command_execution', command: 'ls -la' } })
      )
    ).toEqual([{ kind: 'tool', tool: 'Run', text: 'ls -la' }])
  })

  it('summarizes file changes and mcp tool calls', () => {
    expect(
      parseCodexExecLine(
        line({
          type: 'item.completed',
          item: {
            type: 'file_change',
            changes: [
              { path: '/a.ts', kind: 'edit' },
              { path: '/b.ts', kind: 'add' }
            ]
          }
        })
      )
    ).toEqual([{ kind: 'tool', tool: 'Edit', text: '/a.ts, /b.ts' }])
    expect(
      parseCodexExecLine(
        line({ type: 'item.completed', item: { type: 'mcp_tool_call', server: 'figma', tool: 'get' } })
      )
    ).toEqual([{ kind: 'tool', tool: 'figma.get', text: '' }])
  })

  it('skips reasoning, todo lists, and in-progress duplicates', () => {
    expect(
      parseCodexExecLine(line({ type: 'item.completed', item: { type: 'reasoning' } }))
    ).toEqual([])
    expect(
      parseCodexExecLine(line({ type: 'item.completed', item: { type: 'todo_list' } }))
    ).toEqual([])
    // item.started would otherwise double every tool row.
    expect(
      parseCodexExecLine(
        line({ type: 'item.started', item: { type: 'command_execution', command: 'ls' } })
      )
    ).toEqual([])
  })

  it('ends the turn, and reports failures', () => {
    expect(parseCodexExecLine(line({ type: 'turn.completed', usage: {} }))).toEqual([
      { kind: 'turn-end', text: '' }
    ])
    expect(
      parseCodexExecLine(line({ type: 'turn.failed', error: { message: 'usage limit reached' } }))
    ).toEqual([
      { kind: 'error', text: 'usage limit reached' },
      { kind: 'turn-end', text: '' }
    ])
    const events = parseCodexExecLine(line({ type: 'error', message: 'stream disconnected' }))
    expect(events).toEqual([
      { kind: 'error', text: 'stream disconnected' },
      { kind: 'turn-end', text: '' }
    ])
  })

  it('surfaces unknown item types instead of dropping them', () => {
    expect(
      parseCodexExecLine(
        line({ type: 'item.completed', item: { type: 'web_search', query: 'oklch' } })
      )
    ).toEqual([{ kind: 'tool', tool: 'Search', text: 'oklch' }])
    expect(
      parseCodexExecLine(
        line({ type: 'item.completed', item: { type: 'future_thing', description: 'x' } })
      )
    ).toEqual([{ kind: 'tool', tool: 'future_thing', text: 'x' }])
  })

  it('ignores malformed lines', () => {
    expect(parseCodexExecLine('{oops')).toEqual([])
    expect(parseCodexExecLine('null')).toEqual([])
    expect(parseCodexExecLine('')).toEqual([])
  })
})

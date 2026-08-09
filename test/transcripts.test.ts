import { describe, it, expect } from 'vitest'
import { mungeCwd, parseClaudeLine, parseCodexLine } from '../src/main/transcripts'

const line = (obj: unknown): string => JSON.stringify(obj)

describe('mungeCwd', () => {
  it('replaces every non-alphanumeric character with a dash', () => {
    expect(mungeCwd('/Users/bartbak/Repo/ultra')).toBe('-Users-bartbak-Repo-ultra')
    expect(mungeCwd('/Users/bartbak/.buzz')).toBe('-Users-bartbak--buzz')
    expect(mungeCwd('/tmp/my_app 2')).toBe('-tmp-my-app-2')
  })
})

describe('parseClaudeLine', () => {
  it('parses a typed user message', () => {
    const events = parseClaudeLine(
      line({
        type: 'user',
        uuid: 'u1',
        timestamp: '2026-08-08T20:24:23.660Z',
        message: { role: 'user', content: 'hello there' }
      })
    )
    expect(events).toEqual([
      {
        kind: 'user',
        text: 'hello there',
        source: 'claude',
        uuid: 'u1',
        ts: '2026-08-08T20:24:23.660Z'
      }
    ])
  })

  it('parses assistant text and tool_use items from one line', () => {
    const events = parseClaudeLine(
      line({
        type: 'assistant',
        uuid: 'a1',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me look.' },
            { type: 'tool_use', name: 'Read', input: { file_path: '/tmp/x.ts' } },
            { type: 'tool_use', name: 'Bash', input: { command: 'ls -la', description: 'List' } }
          ]
        }
      })
    )
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({ kind: 'assistant', text: 'Let me look.' })
    expect(events[1]).toMatchObject({ kind: 'tool', tool: 'Read', text: '/tmp/x.ts' })
    expect(events[2]).toMatchObject({ kind: 'tool', tool: 'Bash', text: 'ls -la' })
  })

  it('emits mode events for permission-mode lines', () => {
    expect(parseClaudeLine(line({ type: 'permission-mode', permissionMode: 'plan' }))).toEqual([
      { kind: 'mode', text: 'plan', source: 'claude' }
    ])
  })

  it('skips tool_result carrier user lines', () => {
    const events = parseClaudeLine(
      line({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 't1', content: 'output' }]
        }
      })
    )
    expect(events).toEqual([])
  })

  it('skips sidechain, meta, and non-message lines', () => {
    expect(
      parseClaudeLine(
        line({ type: 'user', isSidechain: true, message: { role: 'user', content: 'sub' } })
      )
    ).toEqual([])
    expect(
      parseClaudeLine(
        line({ type: 'user', isMeta: true, message: { role: 'user', content: 'meta' } })
      )
    ).toEqual([])
    expect(parseClaudeLine(line({ type: 'file-history-snapshot', snapshot: {} }))).toEqual([])
    expect(parseClaudeLine(line({ type: 'mode', mode: 'normal' }))).toEqual([])
  })

  it('skips synthetic command-echo user turns', () => {
    const events = parseClaudeLine(
      line({
        type: 'user',
        message: { role: 'user', content: '<command-name>/clear</command-name>' }
      })
    )
    expect(events).toEqual([])
  })

  it('ignores thinking blocks and empty text', () => {
    const events = parseClaudeLine(
      line({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'hmm' },
            { type: 'text', text: '   ' }
          ]
        }
      })
    )
    expect(events).toEqual([])
  })

  it('returns nothing for malformed JSON', () => {
    expect(parseClaudeLine('{not json')).toEqual([])
    expect(parseClaudeLine('')).toEqual([])
    expect(parseClaudeLine('null')).toEqual([])
  })
})

describe('parseCodexLine', () => {
  it('parses user and agent event messages', () => {
    expect(
      parseCodexLine(
        line({
          timestamp: '2026-08-06T16:51:43.594Z',
          type: 'event_msg',
          payload: { type: 'user_message', message: 'fix the preview' }
        })
      )
    ).toEqual([
      {
        kind: 'user',
        text: 'fix the preview',
        source: 'codex',
        ts: '2026-08-06T16:51:43.594Z'
      }
    ])
    expect(
      parseCodexLine(
        line({
          type: 'event_msg',
          payload: { type: 'agent_message', message: 'On it.', phase: 'commentary' }
        })
      )
    ).toEqual([{ kind: 'assistant', text: 'On it.', source: 'codex', ts: undefined }])
  })

  it('extracts the cmd from exec custom_tool_calls', () => {
    const input =
      'const r = await tools.exec_command({"cmd":"rg -n \\"pinned\\" src | head","workdir":"/x"});'
    const events = parseCodexLine(
      line({
        type: 'response_item',
        payload: { type: 'custom_tool_call', name: 'exec', input }
      })
    )
    expect(events).toEqual([
      {
        kind: 'tool',
        tool: 'exec',
        text: 'rg -n "pinned" src | head',
        source: 'codex',
        ts: undefined
      }
    ])
  })

  it('summarizes function_call arguments', () => {
    const events = parseCodexLine(
      line({
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'wait',
          arguments: '{"description":"wait for cell","cell_id":"18"}'
        }
      })
    )
    expect(events).toEqual([
      { kind: 'tool', tool: 'wait', text: 'wait for cell', source: 'codex', ts: undefined }
    ])
  })

  it('maps turn_context sandbox policies to mode events', () => {
    const mode = (sandbox: string): unknown =>
      parseCodexLine(
        line({ type: 'turn_context', payload: { sandbox_policy: { type: sandbox } } })
      )[0]
    expect(mode('read-only')).toMatchObject({ kind: 'mode', text: 'read-only' })
    expect(mode('workspace-write')).toMatchObject({ kind: 'mode', text: 'auto' })
    expect(mode('danger-full-access')).toMatchObject({ kind: 'mode', text: 'full-access' })
  })

  it('skips reasoning, outputs, and meta lines', () => {
    expect(parseCodexLine(line({ type: 'response_item', payload: { type: 'reasoning' } }))).toEqual(
      []
    )
    expect(
      parseCodexLine(
        line({ type: 'response_item', payload: { type: 'custom_tool_call_output', output: 'x' } })
      )
    ).toEqual([])
    expect(parseCodexLine(line({ type: 'event_msg', payload: { type: 'token_count' } }))).toEqual([])
    expect(parseCodexLine(line({ type: 'session_meta', payload: { cwd: '/x' } }))).toEqual([])
    expect(parseCodexLine('{bad')).toEqual([])
  })
})

import assert from 'node:assert/strict'

import { parseMacroArgumentsInput, resolveCommandMacro } from '../src/macros/commandMacro.ts'
import { defineTest } from './testHarness.ts'

export default [
  defineTest('parseMacroArgumentsInput accepts an empty input as an empty object', () => {
    assert.deepEqual(parseMacroArgumentsInput(''), { ok: true, value: {} })
  }),

  defineTest('parseMacroArgumentsInput rejects non-object JSON', () => {
    assert.deepEqual(parseMacroArgumentsInput('[1, 2, 3]'), {
      ok: false,
      error: 'Macro arguments must be a JSON object.',
    })
  }),

  defineTest('parseMacroArgumentsInput accepts bare object keys for macro args input', () => {
    assert.deepEqual(parseMacroArgumentsInput('{hoge: 0.2, nested: {piyo: 1}}'), {
      ok: true,
      value: { hoge: 0.2, nested: { piyo: 1 } },
    })
  }),

  defineTest('parseMacroArgumentsInput accepts trailing commas and single-quoted strings', () => {
    assert.deepEqual(parseMacroArgumentsInput("{hoge:'fuga', piyo: 1, list: ['a', 'b',],}"), {
      ok: true,
      value: { hoge: 'fuga', piyo: 1, list: ['a', 'b'] },
    })
  }),

  defineTest('resolveCommandMacro replaces placeholders when the command starts with $', () => {
    assert.deepEqual(
      resolveCommandMacro('$execute positioned $(coords.x) $(coords.y) $(coords.z)', {
        coords: { x: 1, y: 2, z: 3 },
      }),
      { ok: true, command: 'execute positioned 1 2 3' },
    )
  }),

  defineTest('resolveCommandMacro reports missing arguments with the placeholder token index', () => {
    assert.deepEqual(resolveCommandMacro('$execute as $(a) positioned $(b) 0 0', { a: '@s' }), {
      ok: false,
      error: 'Missing macro argument: b',
      tokenIndex: 4,
      token: '$(b)',
    })
  }),

  defineTest('resolveCommandMacro reports the first missing placeholder when multiple values are absent', () => {
    assert.deepEqual(resolveCommandMacro('$execute as $(a) at $(b)', {}), {
      ok: false,
      error: 'Missing macro argument: a',
      tokenIndex: 2,
      token: '$(a)',
    })
  }),

  defineTest('resolveCommandMacro rejects incomplete macro placeholders', () => {
    assert.deepEqual(resolveCommandMacro('$execute as $(a', {}), {
      ok: false,
      error: 'Incomplete macro placeholder.',
      tokenIndex: 2,
      token: '$(a',
    })
  }),

  defineTest('resolveCommandMacro rejects an empty macro command body', () => {
    assert.deepEqual(resolveCommandMacro('$', {}), {
      ok: false,
      error: 'Incomplete macro command.',
      tokenIndex: 0,
      token: '$',
    })
  }),

  defineTest('resolveCommandMacro rejects empty macro placeholders', () => {
    assert.deepEqual(resolveCommandMacro('$execute as $()', {}), {
      ok: false,
      error: 'Invalid macro placeholder.',
      tokenIndex: 2,
      token: '$()',
    })
  }),

  defineTest('resolveCommandMacro rejects placeholders with empty path segments', () => {
    assert.deepEqual(resolveCommandMacro('$execute as $(a..b)', { a: { b: '@s' } }), {
      ok: false,
      error: 'Invalid macro placeholder.',
      tokenIndex: 2,
      token: '$(a..b)',
    })
  }),

  defineTest('resolveCommandMacro leaves normal commands unchanged', () => {
    assert.deepEqual(resolveCommandMacro('execute as @e', { target: '@e' }), {
      ok: true,
      command: 'execute as @e',
    })
  }),
]

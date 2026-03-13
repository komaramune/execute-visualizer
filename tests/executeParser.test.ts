import assert from 'node:assert/strict'

import { parseExecuteProgress, tokenizeExecuteWithRanges } from '../src/parser/executeParser.ts'
import type { ExecuteContext } from '../src/types/execute.ts'
import { defineTest } from './testHarness.ts'

const emptyContext: ExecuteContext = { entities: [] }

export default [
  defineTest('tokenizeExecuteWithRanges keeps quoted ] inside selectors', () => {
    const tokens = tokenizeExecuteWithRanges('execute if entity @e[nbt={CustomName:"hello ] world"}] run say hi')

    assert.deepEqual(
      tokens.map((token) => token.text),
      ['execute', 'if', 'entity', '@e[nbt={CustomName:"hello ] world"}]', 'run', 'say', 'hi'],
    )
  }),

  defineTest('parseExecuteProgress accepts ignored selector arguments with nested commas', () => {
    const progress = parseExecuteProgress('execute if entity @e[scores={foo=1..,bar=..3}]', emptyContext)

    assert.equal(progress.error, undefined)
    assert.equal(progress.ast.subcommands.length, 1)
    assert.equal(progress.ast.subcommands[0]?.kind, 'if_entity')
  }),

  defineTest('parseExecuteProgress keeps unsupported if/unless conditions as subcommands', () => {
    const progress = parseExecuteProgress('execute if block 0 0 0 stone unless score @s foo matches 1.. positioned 1 2 3', emptyContext)

    assert.equal(progress.error, undefined)
    assert.deepEqual(progress.ast.subcommands.map((subcommand) => subcommand.kind), [
      'if_unsupported',
      'unless_unsupported',
      'positioned_pos',
    ])
  }),

  defineTest('parseExecuteProgress keeps score conditions intact even when objectives look like subcommands', () => {
    const progress = parseExecuteProgress('execute if score @s positioned = @s foo positioned 1 2 3', emptyContext)

    assert.equal(progress.error, undefined)
    assert.deepEqual(progress.ast.subcommands.map((subcommand) => subcommand.kind), [
      'if_unsupported',
      'positioned_pos',
    ])
  }),

  defineTest('parseExecuteProgress rejects incomplete unsupported if conditions', () => {
    const progress = parseExecuteProgress('execute if block', emptyContext)

    assert.ok(progress.error)
    assert.equal(progress.ast.subcommands.length, 0)
  }),

  defineTest('parseExecuteProgress treats run after an incomplete unsupported condition as incomplete input', () => {
    const progress = parseExecuteProgress('execute if predicate run say hi', emptyContext)

    assert.ok(progress.error)
    assert.equal(progress.error?.message, 'Incomplete if predicate condition.')
    assert.equal(progress.ast.subcommands.length, 0)
  }),

  defineTest('parseExecuteProgress treats the next subcommand after items entity as a boundary, not a selector token', () => {
    const progress = parseExecuteProgress('execute if items entity positioned 1 2 3', emptyContext)

    assert.ok(progress.error)
    assert.equal(progress.error?.message, 'Incomplete if items condition.')
    assert.equal(progress.ast.subcommands.length, 0)
  }),

  defineTest('parseExecuteProgress rejects malformed empty selector arguments', () => {
    const progress = parseExecuteProgress('execute if entity @e[,name=entity1]', emptyContext)

    assert.ok(progress.error)
  }),

  defineTest('parseExecuteProgress treats an empty command as a successful no-op parse', () => {
    const progress = parseExecuteProgress('', emptyContext)

    assert.equal(progress.error, undefined)
    assert.equal(progress.ast.subcommands.length, 0)
  }),
]

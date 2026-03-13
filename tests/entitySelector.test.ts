import assert from 'node:assert/strict'

import { parseTargetSelector } from '../src/selectors/entitySelector.ts'
import { defineTest } from './testHarness.ts'

export default [
  defineTest('parseTargetSelector accepts a trailing comma', () => {
    const parsed = parseTargetSelector('@e[name=entity1,]')

    assert.ok(parsed)
    assert.equal(parsed.target, 'e')
    assert.deepEqual(parsed.args, { name: ['entity1'] })
  }),

  defineTest('parseTargetSelector rejects leading and consecutive empty arguments', () => {
    assert.equal(parseTargetSelector('@e[,name=entity1]'), null)
    assert.equal(parseTargetSelector('@e[name=entity1,,tag=alpha]'), null)
  }),

  defineTest('parseTargetSelector keeps nested commas inside selector values intact', () => {
    const parsed = parseTargetSelector('@e[scores={foo=1..,bar=..3},nbt={CustomName:"hello, world"}]')

    assert.ok(parsed)
    assert.equal(parsed.args.scores?.[0], '{foo=1..,bar=..3}')
    assert.equal(parsed.args.nbt?.[0], '{CustomName:"hello, world"}')
  }),
]

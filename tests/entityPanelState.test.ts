import assert from 'node:assert/strict'

import { createPanel, toEntityState } from '../src/entities/entityPanelState.ts'
import { defineTest } from './testHarness.ts'

const withTags = (tagsInput: string) => ({
  ...createPanel('e-test', 'entity1'),
  tagsInput,
})

export default [
  defineTest('toEntityState parses plain comma-separated tags', () => {
    assert.deepEqual(toEntityState(withTags('hoge, fuga')).tags, ['hoge', 'fuga'])
  }),

  defineTest('toEntityState parses quoted tags without splitting commas inside them', () => {
    assert.deepEqual(toEntityState(withTags('"hoge, fuga", piyo')).tags, ['hoge, fuga', 'piyo'])
  }),

  defineTest('toEntityState parses bracketed tag lists', () => {
    assert.deepEqual(toEntityState(withTags('["hoge", "fuga"]')).tags, ['hoge', 'fuga'])
  }),

  defineTest('toEntityState parses bracketed tag lists with quoted commas', () => {
    assert.deepEqual(toEntityState(withTags('["hoge, fuga", piyo]')).tags, ['hoge, fuga', 'piyo'])
  }),

  defineTest('toEntityState keeps parsing incomplete bracketed tag lists while editing', () => {
    assert.deepEqual(toEntityState(withTags('["hoge", "fuga"')).tags, ['hoge', 'fuga'])
  }),

  defineTest('toEntityState keeps parsing incomplete quoted tags while editing', () => {
    assert.deepEqual(toEntityState(withTags('"hoge, fuga')).tags, ['hoge, fuga'])
  }),
]

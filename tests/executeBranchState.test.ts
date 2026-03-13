import assert from 'node:assert/strict'

import {
  ROOT_COMMAND_SOURCE_STATE,
  buildBranchLastStateMap,
  buildBranchRows,
  buildRunMarkerStates,
  collectHeaderHighlightedStepIds,
  filterVisibleIds,
  resolveHoveredState,
} from '../src/branching/executeBranchState.ts'
import type { CommandSourceState, ExecuteStep, ExecuteSubcommand } from '../src/types/execute.ts'
import { defineTest } from './testHarness.ts'

const makeState = (x: number): CommandSourceState => ({
  executorId: null,
  position: { x, y: 0, z: 0 },
  rotation: { yaw: -90, pitch: 0 },
  anchor: 'feet',
})

const makeSubcommand = (kind: ExecuteSubcommand['kind']): ExecuteSubcommand => {
  switch (kind) {
    case 'as':
    case 'at':
    case 'if_entity':
    case 'unless_entity':
    case 'positioned_as':
    case 'rotated_as':
    case 'facing_entity_feet':
    case 'facing_entity_eyes':
      return { kind, entity: '@e', tokenRange: { start: 0, end: 0 } }
    case 'align':
      return { kind, axes: ['x'], tokenRange: { start: 0, end: 0 } }
    case 'anchored':
      return { kind, anchor: 'feet', tokenRange: { start: 0, end: 0 } }
    case 'positioned_pos':
    case 'facing_pos':
      return {
        kind,
        position: {
          x: { kind: 'absolute', raw: '0', value: 0 },
          y: { kind: 'absolute', raw: '0', value: 0 },
          z: { kind: 'absolute', raw: '0', value: 0 },
        },
        tokenRange: { start: 0, end: 0 },
      }
    case 'rotated_angles':
      return {
        kind,
        yaw: { kind: 'absolute', raw: '0', value: 0 },
        pitch: { kind: 'absolute', raw: '0', value: 0 },
        tokenRange: { start: 0, end: 0 },
      }
  }
}

const makeStep = (
  id: string,
  branchId: string,
  index: number,
  afterX: number,
  parentStepId: string | null,
): ExecuteStep => ({
  id,
  branchId,
  parentStepId,
  index,
  subcommand: makeSubcommand('as'),
  before: makeState(afterX - 1),
  after: makeState(afterX),
})

const steps = [
  makeStep('s0', 'root', 0, 1, null),
  makeStep('s1', 'root', 1, 2, 's0'),
  makeStep('s2', 'child-late', 2, 3, 's1'),
  makeStep('s3', 'child-early', 1, 4, 's0'),
]

export default [
  defineTest('buildBranchRows keeps tree order and step order stable', () => {
    const rows = buildBranchRows(steps)

    assert.deepEqual(rows.map((row) => row.branchId), ['root', 'child-late', 'child-early'])
    assert.deepEqual(rows[0]?.steps.map((step) => step.id), ['s0', 's1'])
  }),

  defineTest('buildRunMarkerStates uses the last step of each branch', () => {
    const rows = buildBranchRows(steps)
    const runStates = buildRunMarkerStates(3, steps.length, rows, ROOT_COMMAND_SOURCE_STATE)

    assert.deepEqual(
      runStates.map((entry) => [entry.branchId, entry.state.position.x]),
      [
        ['root', 2],
        ['child-late', 3],
        ['child-early', 4],
      ],
    )
  }),

  defineTest('buildRunMarkerStates keeps a root run marker when there are no subcommand steps', () => {
    const runStates = buildRunMarkerStates(1, 0, [], ROOT_COMMAND_SOURCE_STATE)

    assert.deepEqual(runStates, [{ branchId: 'root', state: ROOT_COMMAND_SOURCE_STATE }])
  }),

  defineTest('collectHeaderHighlightedStepIds merges row and column highlights', () => {
    const ids = collectHeaderHighlightedStepIds(steps, false, 'root', 2)

    assert.deepEqual(ids.sort(), ['s0', 's1', 's2'].sort())
  }),

  defineTest('resolveHoveredState prefers root, then run branch, then step', () => {
    const rows = buildBranchRows(steps)
    const map = buildBranchLastStateMap(rows)

    assert.equal(resolveHoveredState(true, null, null, steps, map, ROOT_COMMAND_SOURCE_STATE), ROOT_COMMAND_SOURCE_STATE)
    assert.equal(resolveHoveredState(false, 'child-early', null, steps, map, ROOT_COMMAND_SOURCE_STATE)?.position.x, 4)
    assert.equal(resolveHoveredState(false, null, 's1', steps, map, ROOT_COMMAND_SOURCE_STATE)?.position.x, 2)
  }),

  defineTest('filterVisibleIds removes ids that are no longer present', () => {
    assert.deepEqual(filterVisibleIds(['a', 'b', 'c'], new Set(['b', 'c', 'd'])), ['b', 'c'])
  }),
]

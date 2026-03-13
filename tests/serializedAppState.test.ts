import assert from 'node:assert/strict'

import { createPanel } from '../src/entities/entityPanelState.ts'
import { createSerializedAppState, parseSerializedAppState } from '../src/state/serializedAppState.ts'
import { defineTest } from './testHarness.ts'

const limits = {
  maxMarkerSize: 6,
  minSidePanelWidth: 280,
  minViewOptionsWidth: 260,
  minCommandPanelHeight: 120,
}

export default [
  defineTest('createSerializedAppState preserves the expected JSON shape', () => {
    const panel = createPanel('e-1', 'entity1')
    const serialized = createSerializedAppState({
      command: 'execute as @e run say hi',
      entityPanels: [panel],
      viewMarkerSize: 3,
      viewMarkerOpacity: 75,
      viewTargetSelection: 'coords',
      viewTargetCoords: { x: 1, y: 2, z: 3 },
      macroArgsInput: '{"x":1}',
      sidePanelWidth: 560,
      viewOptionsWidth: 320,
      commandPanelHeight: 260,
      hiddenStepIds: ['step-1'],
      hiddenRunBranchIds: ['branch-1'],
    })

    assert.equal(serialized.version, 1)
    assert.equal(serialized.command, 'execute as @e run say hi')
    assert.equal(serialized.entityPanels[0]?.id, 'e-1')
    assert.deepEqual(serialized.viewOptions.targetCoords, { x: 1, y: 2, z: 3 })
    assert.equal(serialized.viewOptions.macroArgsInput, '{"x":1}')
    assert.deepEqual(serialized.visibility.hiddenRunBranchIds, ['branch-1'])
  }),

  defineTest('parseSerializedAppState normalizes saved values for the UI', () => {
    const restored = parseSerializedAppState(
      {
        command: 'execute',
        entityPanels: [createPanel('e-1', 'entity1')],
        viewOptions: {
          markerSize: 99,
          markerOpacity: -5,
          targetSelection: 'entity:0',
          targetCoords: { x: 1.25, y: -2, z: 3 },
          macroArgsInput: '{"target":"@s"}',
        },
        layout: {
          sidePanelWidth: 100,
          viewOptionsWidth: 40,
          commandPanelHeight: 20,
        },
        visibility: {
          hiddenStepIds: ['step-1', 2],
          hiddenRunBranchIds: ['branch-1', false],
        },
      },
      limits,
    )

    assert.equal(restored.viewMarkerSize, 6)
    assert.equal(restored.viewMarkerOpacity, 0)
    assert.equal(restored.viewTargetSelection, 'entity:e-1')
    assert.equal(restored.viewTargetX, '1.25')
    assert.equal(restored.viewTargetY, '-2')
    assert.equal(restored.macroArgsInput, '{"target":"@s"}')
    assert.equal(restored.sidePanelWidth, 280)
    assert.equal(restored.viewOptionsWidth, 260)
    assert.equal(restored.commandPanelHeight, 120)
    assert.deepEqual(restored.hiddenStepIds, ['step-1'])
    assert.deepEqual(restored.hiddenRunBranchIds, ['branch-1'])
  }),

  defineTest('parseSerializedAppState rejects invalid entity panels', () => {
    assert.throws(
      () =>
        parseSerializedAppState(
          {
            command: 'execute',
            entityPanels: [{ id: 'e-1' }],
            viewOptions: {
              markerSize: 1,
              markerOpacity: 50,
              targetSelection: 'coords',
              targetCoords: { x: 0, y: 0, z: 0 },
            },
            layout: {
              sidePanelWidth: 560,
              viewOptionsWidth: 320,
              commandPanelHeight: 260,
            },
          },
          limits,
        ),
      /Invalid entity panel\./,
    )
  }),

  defineTest('parseSerializedAppState rejects duplicate panel ids', () => {
    assert.throws(
      () =>
        parseSerializedAppState(
          {
            command: 'execute',
            entityPanels: [createPanel('dup', 'entity1'), createPanel('dup', 'entity2')],
            viewOptions: {
              markerSize: 1,
              markerOpacity: 50,
              targetSelection: 'coords',
              targetCoords: { x: 0, y: 0, z: 0 },
            },
            layout: {
              sidePanelWidth: 560,
              viewOptionsWidth: 320,
              commandPanelHeight: 260,
            },
          },
          limits,
        ),
      /Duplicate entity panel id\./,
    )
  }),
]

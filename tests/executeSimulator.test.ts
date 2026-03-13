import assert from 'node:assert/strict'

import { evaluateExecute } from '../src/simulator/executeSimulator.ts'
import type { EntityState, ExecuteContext } from '../src/types/execute.ts'
import { defineTest } from './testHarness.ts'

const createEntity = (overrides: Partial<EntityState> & Pick<EntityState, 'id' | 'name'>): EntityState => ({
  id: overrides.id,
  name: overrides.name,
  position: overrides.position ?? { x: 0, y: 0, z: 0 },
  rotation: overrides.rotation ?? { yaw: 0, pitch: 0 },
  tags: overrides.tags ?? [],
  height: overrides.height ?? 1.8,
  width: overrides.width ?? 0.6,
  eyeHeight: overrides.eyeHeight ?? 1.62,
  entityType: overrides.entityType ?? 'other',
})

export default [
  defineTest('evaluateExecute keeps executor identity separate even when names are duplicated', () => {
    const lower = createEntity({
      id: 'dup-1',
      name: 'dup',
      position: { x: 0, y: 0, z: 10 },
      eyeHeight: 1,
    })
    const higher = createEntity({
      id: 'dup-2',
      name: 'dup',
      position: { x: 0, y: 10, z: 10 },
      eyeHeight: 5,
    })
    const context: ExecuteContext = { entity: lower, entities: [lower, higher] }

    const result = evaluateExecute('execute as @e[name=dup] facing entity @s eyes', context)

    assert.equal(result.ok, true)
    if (!result.ok) {
      return
    }

    const facingSteps = result.steps.filter((step) => step.subcommand.kind === 'facing_entity_eyes')
    assert.equal(facingSteps.length, 2)

    const pitches = facingSteps
      .map((step) => step.after.rotation.pitch)
      .sort((left, right) => left - right)

    assert.ok(Math.abs(pitches[0] + 49.72013693104356) < 0.001)
    assert.ok(Math.abs(pitches[1] + 5.710593137499643) < 0.001)
  }),

  defineTest('anchored eyes does not raise the anchor when there is no executor', () => {
    const contextEntity = createEntity({
      id: 'context',
      name: 'context',
      eyeHeight: 10,
    })
    const context: ExecuteContext = { entity: contextEntity, entities: [contextEntity] }

    const result = evaluateExecute('execute anchored eyes facing 0 1 0', context)

    assert.equal(result.ok, true)
    if (!result.ok) {
      return
    }

    const facingStep = result.steps.find((step) => step.subcommand.kind === 'facing_pos')
    assert.ok(facingStep)
    assert.ok(Math.abs(facingStep.after.rotation.pitch + 54.735610317245346) < 0.001)
  }),

  defineTest('absolute integer positioned coordinates apply the Java Edition x/z center offset', () => {
    const result = evaluateExecute('execute positioned 1 2 -3', { entities: [] })

    assert.equal(result.ok, true)
    if (!result.ok) {
      return
    }

    const positionedStep = result.steps.find((step) => step.subcommand.kind === 'positioned_pos')
    assert.ok(positionedStep)
    assert.deepEqual(positionedStep.after.position, { x: 1.5, y: 2, z: -2.5 })
  }),

  defineTest('unsupported if/unless conditions are treated as no-op subcommands', () => {
    const result = evaluateExecute('execute if block 0 0 0 stone unless score @s foo matches 1.. positioned 1 2 3', { entities: [] })

    assert.equal(result.ok, true)
    if (!result.ok) {
      return
    }

    assert.deepEqual(result.steps.map((step) => step.subcommand.kind), [
      'if_unsupported',
      'unless_unsupported',
      'positioned_pos',
    ])

    const positionedStep = result.steps.find((step) => step.subcommand.kind === 'positioned_pos')
    assert.ok(positionedStep)
    assert.deepEqual(positionedStep.after.position, { x: 1.5, y: 2, z: 3.5 })
  }),

  defineTest('unsupported score conditions do not split when objective names match subcommand keywords', () => {
    const result = evaluateExecute('execute if score @s positioned = @s foo positioned 1 2 3', { entities: [] })

    assert.equal(result.ok, true)
    if (!result.ok) {
      return
    }

    assert.deepEqual(result.steps.map((step) => step.subcommand.kind), [
      'if_unsupported',
      'positioned_pos',
    ])
  }),

  defineTest('quoted selector name values match entities', () => {
    const entity = createEntity({
      id: 'entity-1',
      name: 'entity1',
    })
    const context: ExecuteContext = { entity, entities: [entity] }

    const result = evaluateExecute('execute if entity @e[name="entity1"]', context)

    assert.equal(result.ok, true)
    if (!result.ok) {
      return
    }

    assert.deepEqual(result.steps.map((step) => step.subcommand.kind), ['if_entity'])
  }),

  defineTest('quoted selector tag values match tags that include commas', () => {
    const entity = createEntity({
      id: 'entity-1',
      name: 'entity1',
      tags: ['hoge, fuga'],
    })
    const context: ExecuteContext = { entity, entities: [entity] }

    const result = evaluateExecute('execute if entity @e[tag="hoge, fuga"]', context)

    assert.equal(result.ok, true)
    if (!result.ok) {
      return
    }

    assert.deepEqual(result.steps.map((step) => step.subcommand.kind), ['if_entity'])
  }),
]

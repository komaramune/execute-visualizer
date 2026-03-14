import assert from 'node:assert/strict'

import { getSelectorVisualization } from '../src/selectors/selectorVisualization.ts'
import { defineTest } from './testHarness.ts'

export default [
  defineTest('getSelectorVisualization merges selector distance ranges at the selector origin', () => {
    const visualization = getSelectorVisualization(
      {
        kind: 'as',
        entity: '@e[x=4,y=5,z=6,distance=..8,distance=3..]',
        tokenRange: { start: 0, end: 0 },
      },
      {
        executorId: null,
        position: { x: 0, y: 0, z: 0 },
        rotation: { yaw: 0, pitch: 0 },
        anchor: 'feet',
      },
    )

    assert.deepEqual(visualization, {
      origin: { x: 4, y: 5, z: 6 },
      distance: { min: 3, max: 8 },
      box: null,
    })
  }),

  defineTest('getSelectorVisualization builds an inclusive dx/dy/dz selection box from the current origin', () => {
    const visualization = getSelectorVisualization(
      {
        kind: 'at',
        entity: '@e[dx=2,dy=-1,dz=0]',
        tokenRange: { start: 0, end: 0 },
      },
      {
        executorId: 'e-1',
        position: { x: 10, y: 20, z: 30 },
        rotation: { yaw: 45, pitch: 5 },
        anchor: 'eyes',
      },
    )

    assert.deepEqual(visualization, {
      origin: { x: 10, y: 20, z: 30 },
      distance: null,
      box: {
        min: { x: 10, y: 19, z: 30 },
        max: { x: 13, y: 21, z: 31 },
      },
    })
  }),

  defineTest('getSelectorVisualization returns null when the selector has no distance or box range', () => {
    const visualization = getSelectorVisualization(
      {
        kind: 'unless_entity',
        entity: '@e[tag=demo]',
        tokenRange: { start: 0, end: 0 },
      },
      {
        executorId: null,
        position: { x: 1, y: 2, z: 3 },
        rotation: { yaw: 0, pitch: 0 },
        anchor: 'feet',
      },
    )

    assert.equal(visualization, null)
  }),
]

import type {
  AngleToken,
  CommandSourceState,
  CoordinateToken,
  EntityState,
  ExecuteContext,
  ExecuteStep,
  ParseFailure,
  PositionToken,
  Rotation,
  Vec3,
} from '../types/execute'
import { parseExecute } from '../parser/executeParser'
import { getUnknownSelectorKeys, matchesEntitySelector, parseDistanceValue, parseLimitValue, parseRotationValue, parseSelectorCoordinateValue, parseSelectorStringValue, parseSortValue, parseTargetSelector } from '../selectors/entitySelector'

const SUPPORTED_SELECTOR_KEYS = ['name', 'tag', 'distance', 'type', 'gamemode', 'team', 'scores', 'nbt', 'level', 'x_rotation', 'y_rotation', 'sort', 'limit', 'x', 'y', 'z', 'dx', 'dy', 'dz']

const cloneState = (state: CommandSourceState): CommandSourceState => ({
  executorId: state.executorId,
  anchor: state.anchor,
  position: { ...state.position },
  rotation: { ...state.rotation },
})

const applyAngle = (base: number, token: AngleToken): number =>
  token.kind === 'relative' ? base + token.value : token.value

const degToRad = (degree: number): number => (degree * Math.PI) / 180

const getClampedEyeHeight = (entity: EntityState): number =>
  Math.min(Math.max(entity.eyeHeight, 0), Math.max(entity.height, 0))

const normalize = (v: Vec3): Vec3 => {
  const len = Math.hypot(v.x, v.y, v.z)
  if (len === 0) {
    return { x: 0, y: 0, z: 0 }
  }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

const isIntegerAbsoluteCoordinate = (token: CoordinateToken): boolean =>
  token.kind === 'absolute' && /^-?\d+$/.test(token.raw)

const getAnchorReferencePosition = (state: CommandSourceState, context: ExecuteContext): Vec3 => {
  if (state.anchor !== 'eyes') {
    return { ...state.position }
  }

  const executorEntity = state.executorId ? resolveEntityById(context, state.executorId) : null
  const eyeHeight = executorEntity ? getClampedEyeHeight(executorEntity) : 0
  return {
    x: state.position.x,
    y: state.position.y + eyeHeight,
    z: state.position.z,
  }
}

const resolvePosition = (current: CommandSourceState, position: PositionToken, context?: ExecuteContext): Vec3 => {
  const tokens: CoordinateToken[] = [position.x, position.y, position.z]
  const isLocal = tokens.every((token) => token.kind === 'local')

  if (isLocal) {
    const basePosition = context ? getAnchorReferencePosition(current, context) : current.position
    const yawRad = degToRad(current.rotation.yaw)
    const pitchRad = degToRad(current.rotation.pitch)

    const forward = normalize({
      x: -Math.sin(yawRad) * Math.cos(pitchRad),
      y: -Math.sin(pitchRad),
      z: Math.cos(yawRad) * Math.cos(pitchRad),
    })
    const worldUp = { x: 0, y: 1, z: 0 }
    const left = normalize(cross(worldUp, forward))
    const up = normalize(cross(forward, left))

    return {
      x:
        basePosition.x +
        left.x * position.x.value +
        up.x * position.y.value +
        forward.x * position.z.value,
      y:
        basePosition.y +
        left.y * position.x.value +
        up.y * position.y.value +
        forward.y * position.z.value,
      z:
        basePosition.z +
        left.z * position.x.value +
        up.z * position.y.value +
        forward.z * position.z.value,
    }
  }

  const resolveAxis = (base: number, token: CoordinateToken, axis: 'x' | 'y' | 'z'): number => {
    if (token.kind === 'absolute') {
      if ((axis === 'x' || axis === 'z') && isIntegerAbsoluteCoordinate(token)) {
        return token.value + 0.5
      }
      return token.value
    }
    return base + token.value
  }

  return {
    x: resolveAxis(current.position.x, position.x, 'x'),
    y: resolveAxis(current.position.y, position.y, 'y'),
    z: resolveAxis(current.position.z, position.z, 'z'),
  }
}

const matchesDistance = (from: Vec3, to: Vec3, value: string): boolean => {
  const range = parseDistanceValue(value)
  if (!range) {
    return false
  }

  const distance = distanceBetween(from, to)
  if (range.min !== null && distance < range.min) {
    return false
  }
  if (range.max !== null && distance > range.max) {
    return false
  }
  return true
}

const matchesRotation = (angle: number, value: string): boolean => {
  const range = parseRotationValue(value)
  if (!range) {
    return false
  }

  if (range.min !== null && angle < range.min) {
    return false
  }
  if (range.max !== null && angle > range.max) {
    return false
  }
  return true
}

const distanceBetween = (from: Vec3, to: Vec3): number =>
  Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z)

const intersectsSelectorVolume = (entity: EntityState, origin: Vec3, dx: number, dy: number, dz: number): boolean => {
  const minX = Math.min(origin.x, origin.x + dx)
  const minY = Math.min(origin.y, origin.y + dy)
  const minZ = Math.min(origin.z, origin.z + dz)
  const maxXExclusive = Math.max(origin.x, origin.x + dx) + 1
  const maxYExclusive = Math.max(origin.y, origin.y + dy) + 1
  const maxZExclusive = Math.max(origin.z, origin.z + dz) + 1

  const halfWidth = Math.max(entity.width, 0) / 2
  const entityMinX = entity.position.x - halfWidth
  const entityMaxX = entity.position.x + halfWidth
  const entityMinY = entity.position.y
  const entityMaxY = entity.position.y + Math.max(entity.height, 0)
  const entityMinZ = entity.position.z - halfWidth
  const entityMaxZ = entity.position.z + halfWidth

  return !(
    entityMaxX <= minX || entityMinX >= maxXExclusive ||
    entityMaxY <= minY || entityMinY >= maxYExclusive ||
    entityMaxZ <= minZ || entityMinZ >= maxZExclusive
  )
}

const lookAtRotation = (from: Vec3, to: Vec3, fallback: Rotation): Rotation => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z

  const horizontal = Math.hypot(dx, dz)
  if (horizontal === 0 && dy === 0) {
    return fallback
  }

  const yaw = (Math.atan2(-dx, dz) * 180) / Math.PI
  const pitch = (Math.atan2(-dy, horizontal) * 180) / Math.PI

  return { yaw, pitch }
}

const targetEyePosition = (entity: EntityState): Vec3 => ({
  x: entity.position.x,
  y: entity.position.y + getClampedEyeHeight(entity),
  z: entity.position.z,
})

export type EvaluateSuccess = {
  ok: true
  steps: ExecuteStep[]
}

export type EvaluateFailure = ParseFailure

export type EvaluateResult = EvaluateSuccess | EvaluateFailure

const resolveEntityById = (context: ExecuteContext, id: string): EntityState | null => {
  const fromList = context.entities.find((entity) => entity.id === id)
  if (fromList) {
    return fromList
  }
  if (context.entity?.id === id) {
    return context.entity
  }
  return null
}

const listCandidates = (context: ExecuteContext): EntityState[] => {
  const candidates = [...context.entities]
  if (context.entity && !candidates.includes(context.entity)) {
    candidates.push(context.entity)
  }
  return candidates
}

const resolveEntities = (
  context: ExecuteContext,
  selector: string,
  currentState: CommandSourceState,
): EntityState[] => {
  const parsedSelector = parseTargetSelector(selector)
  if (!parsedSelector) {
    return []
  }

  const unknownKeys = getUnknownSelectorKeys(parsedSelector, SUPPORTED_SELECTOR_KEYS)
  if (unknownKeys.length > 0) {
    return []
  }

  const selectorOrigin: Vec3 = {
    x: parsedSelector.args.x ? parseSelectorCoordinateValue(parsedSelector.args.x[parsedSelector.args.x.length - 1]) ?? currentState.position.x : currentState.position.x,
    y: parsedSelector.args.y ? parseSelectorCoordinateValue(parsedSelector.args.y[parsedSelector.args.y.length - 1]) ?? currentState.position.y : currentState.position.y,
    z: parsedSelector.args.z ? parseSelectorCoordinateValue(parsedSelector.args.z[parsedSelector.args.z.length - 1]) ?? currentState.position.z : currentState.position.z,
  }

  const hasVolumeArgument = Boolean(parsedSelector.args.dx || parsedSelector.args.dy || parsedSelector.args.dz)
  const selectorDelta = hasVolumeArgument
    ? {
        dx: parsedSelector.args.dx ? parseSelectorCoordinateValue(parsedSelector.args.dx[parsedSelector.args.dx.length - 1]) ?? 0 : 0,
        dy: parsedSelector.args.dy ? parseSelectorCoordinateValue(parsedSelector.args.dy[parsedSelector.args.dy.length - 1]) ?? 0 : 0,
        dz: parsedSelector.args.dz ? parseSelectorCoordinateValue(parsedSelector.args.dz[parsedSelector.args.dz.length - 1]) ?? 0 : 0,
      }
    : null

  const matchers = {
    name: (candidate: EntityState, value: string) => candidate.name === parseSelectorStringValue(value),
    tag: (candidate: EntityState, value: string) => candidate.tags.includes(parseSelectorStringValue(value)),
    distance: (candidate: EntityState, value: string) => matchesDistance(selectorOrigin, candidate.position, value),
    type: () => true,
    gamemode: () => true,
    team: () => true,
    scores: () => true,
    nbt: () => true,
    level: () => true,
    x_rotation: (candidate: EntityState, value: string) => matchesRotation(candidate.rotation.pitch, value),
    y_rotation: (candidate: EntityState, value: string) => matchesRotation(candidate.rotation.yaw, value),
    sort: () => true,
    limit: () => true,
    x: () => true,
    y: () => true,
    z: () => true,
    dx: () => true,
    dy: () => true,
    dz: () => true,
  }

  const applySortAndLimit = (entities: EntityState[]): EntityState[] => {
    const sorted = [...entities]
    const sortValue = parsedSelector.args.sort?.[parsedSelector.args.sort.length - 1]
    const parsedSort = sortValue ? parseSortValue(sortValue) : null

    switch (parsedSort) {
      case 'nearest':
        sorted.sort((a, b) => distanceBetween(selectorOrigin, a.position) - distanceBetween(selectorOrigin, b.position))
        break
      case 'furthest':
        sorted.sort((a, b) => distanceBetween(selectorOrigin, b.position) - distanceBetween(selectorOrigin, a.position))
        break
      case 'random':
        for (let index = sorted.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(Math.random() * (index + 1))
          ;[sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]]
        }
        break
      case 'arbitrary':
      default:
        break
    }

    const limitValue = parsedSelector.args.limit?.[parsedSelector.args.limit.length - 1]
    const parsedLimit = limitValue ? parseLimitValue(limitValue) : null
    return parsedLimit === null ? sorted : sorted.slice(0, parsedLimit)
  }

  if (parsedSelector.target === 's') {
    if (!currentState.executorId) {
      return []
    }
    const executorEntity = resolveEntityById(context, currentState.executorId)
    if (!executorEntity) {
      return []
    }

    const matched = matchesEntitySelector(executorEntity, parsedSelector, matchers) ? [executorEntity] : []
    return applySortAndLimit(matched)
  }

  const baseCandidates = listCandidates(context).filter((entity) => {
    if (parsedSelector.target === 'a' || parsedSelector.target === 'p' || parsedSelector.target === 'r') {
      return entity.entityType === 'player'
    }
    return true
  })

  const matched = baseCandidates.filter((entity) =>
    matchesEntitySelector(entity, parsedSelector, matchers) &&
    (!selectorDelta || intersectsSelectorVolume(entity, selectorOrigin, selectorDelta.dx, selectorDelta.dy, selectorDelta.dz))
  )
  if (parsedSelector.target === 'n') {
    return matched
      .sort((a, b) => distanceBetween(selectorOrigin, a.position) - distanceBetween(selectorOrigin, b.position))
      .slice(0, 1)
  }
  if (parsedSelector.target === 'p') {
    return matched
      .sort((a, b) => distanceBetween(selectorOrigin, a.position) - distanceBetween(selectorOrigin, b.position))
      .slice(0, 1)
  }
  if (parsedSelector.target === 'r') {
    if (matched.length === 0) {
      return []
    }
    const index = Math.floor(Math.random() * matched.length)
    return [matched[index]]
  }

  return applySortAndLimit(matched)
}

type BranchContext = {
  branchId: string
  tailStepId: string | null
  state: CommandSourceState
}

export const evaluateExecute = (input: string, context: ExecuteContext): EvaluateResult => {
  const parsed = parseExecute(input, context)
  if (!parsed.ok) {
    return parsed
  }

  const steps: ExecuteStep[] = []

  let branchSerial = 1
  let stepSerial = 1

  const initialState: CommandSourceState = {
    executorId: null,
    position: { x: 0, y: 0, z: 0 },
    rotation: { yaw: -90, pitch: 0 },
    anchor: 'feet',
  }

  let contexts: BranchContext[] = [
    {
      branchId: 'b0',
      tailStepId: null,
      state: initialState,
    },
  ]

  for (let subcommandIndex = 0; subcommandIndex < parsed.ast.subcommands.length; subcommandIndex += 1) {
    if (contexts.length === 0) {
      break
    }

    const subcommand = parsed.ast.subcommands[subcommandIndex]
    const nextContexts: BranchContext[] = []

    for (const current of contexts) {
      const before = cloneState(current.state)

      switch (subcommand.kind) {
        case 'as': {
          const targets = resolveEntities(context, subcommand.entity, before)
          if (targets.length === 0) {
            break
          }

          targets.forEach((target, targetIndex) => {
            const after = cloneState(before)
            after.executorId = target.id

            const branchId =
              targets.length === 1 || targetIndex === 0 ? current.branchId : `b${branchSerial++}`
            const stepId = `s${stepSerial++}`

            steps.push({
              id: stepId,
              branchId,
              parentStepId: current.tailStepId,
              index: subcommandIndex,
              subcommand,
              before: cloneState(before),
              after,
            })

            nextContexts.push({
              branchId,
              tailStepId: stepId,
              state: after,
            })
          })
          break
        }

        case 'at': {
          const targets = resolveEntities(context, subcommand.entity, before)
          if (targets.length === 0) {
            break
          }

          targets.forEach((target, targetIndex) => {
            const after = cloneState(before)
            after.position = { ...target.position }
            after.rotation = { ...target.rotation }

            const branchId =
              targets.length === 1 || targetIndex === 0 ? current.branchId : `b${branchSerial++}`
            const stepId = `s${stepSerial++}`

            steps.push({
              id: stepId,
              branchId,
              parentStepId: current.tailStepId,
              index: subcommandIndex,
              subcommand,
              before: cloneState(before),
              after,
            })

            nextContexts.push({
              branchId,
              tailStepId: stepId,
              state: after,
            })
          })
          break
        }

        case 'if_entity': {
          const targets = resolveEntities(context, subcommand.entity, before)
          if (targets.length === 0) {
            break
          }

          const after = cloneState(before)
          const stepId = `s${stepSerial++}`
          steps.push({
            id: stepId,
            branchId: current.branchId,
            parentStepId: current.tailStepId,
            index: subcommandIndex,
            subcommand,
            before,
            after,
          })

          nextContexts.push({
            branchId: current.branchId,
            tailStepId: stepId,
            state: after,
          })
          break
        }

        case 'if_unsupported': {
          const after = cloneState(before)
          const stepId = `s${stepSerial++}`
          steps.push({
            id: stepId,
            branchId: current.branchId,
            parentStepId: current.tailStepId,
            index: subcommandIndex,
            subcommand,
            before,
            after,
          })

          nextContexts.push({
            branchId: current.branchId,
            tailStepId: stepId,
            state: after,
          })
          break
        }

        case 'unless_entity': {
          const targets = resolveEntities(context, subcommand.entity, before)
          if (targets.length > 0) {
            break
          }

          const after = cloneState(before)
          const stepId = `s${stepSerial++}`
          steps.push({
            id: stepId,
            branchId: current.branchId,
            parentStepId: current.tailStepId,
            index: subcommandIndex,
            subcommand,
            before,
            after,
          })

          nextContexts.push({
            branchId: current.branchId,
            tailStepId: stepId,
            state: after,
          })
          break
        }

        case 'unless_unsupported': {
          const after = cloneState(before)
          const stepId = `s${stepSerial++}`
          steps.push({
            id: stepId,
            branchId: current.branchId,
            parentStepId: current.tailStepId,
            index: subcommandIndex,
            subcommand,
            before,
            after,
          })

          nextContexts.push({
            branchId: current.branchId,
            tailStepId: stepId,
            state: after,
          })
          break
        }

        case 'align': {
          const after = cloneState(before)
          for (const axis of subcommand.axes) {
            after.position[axis] = Math.floor(after.position[axis])
          }

          const stepId = `s${stepSerial++}`
          steps.push({
            id: stepId,
            branchId: current.branchId,
            parentStepId: current.tailStepId,
            index: subcommandIndex,
            subcommand,
            before,
            after,
          })

          nextContexts.push({
            branchId: current.branchId,
            tailStepId: stepId,
            state: after,
          })
          break
        }

        case 'anchored': {
          const after = cloneState(before)
          after.anchor = subcommand.anchor

          const stepId = `s${stepSerial++}`
          steps.push({
            id: stepId,
            branchId: current.branchId,
            parentStepId: current.tailStepId,
            index: subcommandIndex,
            subcommand,
            before,
            after,
          })

          nextContexts.push({
            branchId: current.branchId,
            tailStepId: stepId,
            state: after,
          })
          break
        }

        case 'positioned_as': {
          const targets = resolveEntities(context, subcommand.entity, before)
          if (targets.length === 0) {
            break
          }

          targets.forEach((target, targetIndex) => {
            const after = cloneState(before)
            after.position = { ...target.position }

            const branchId =
              targets.length === 1 || targetIndex === 0 ? current.branchId : `b${branchSerial++}`
            const stepId = `s${stepSerial++}`

            steps.push({
              id: stepId,
              branchId,
              parentStepId: current.tailStepId,
              index: subcommandIndex,
              subcommand,
              before: cloneState(before),
              after,
            })

            nextContexts.push({
              branchId,
              tailStepId: stepId,
              state: after,
            })
          })
          break
        }

        case 'positioned_pos': {
          const after = cloneState(before)
          after.position = resolvePosition(before, subcommand.position, context)
          if (subcommand.position.x.kind === 'local') {
            after.anchor = 'feet'
          }

          const stepId = `s${stepSerial++}`
          steps.push({
            id: stepId,
            branchId: current.branchId,
            parentStepId: current.tailStepId,
            index: subcommandIndex,
            subcommand,
            before,
            after,
          })

          nextContexts.push({
            branchId: current.branchId,
            tailStepId: stepId,
            state: after,
          })
          break
        }

        case 'rotated_as': {
          const targets = resolveEntities(context, subcommand.entity, before)
          if (targets.length === 0) {
            break
          }

          targets.forEach((target, targetIndex) => {
            const after = cloneState(before)
            after.rotation = { ...target.rotation }

            const branchId =
              targets.length === 1 || targetIndex === 0 ? current.branchId : `b${branchSerial++}`
            const stepId = `s${stepSerial++}`

            steps.push({
              id: stepId,
              branchId,
              parentStepId: current.tailStepId,
              index: subcommandIndex,
              subcommand,
              before: cloneState(before),
              after,
            })

            nextContexts.push({
              branchId,
              tailStepId: stepId,
              state: after,
            })
          })
          break
        }

        case 'rotated_angles': {
          const after = cloneState(before)
          after.rotation = {
            yaw: applyAngle(before.rotation.yaw, subcommand.yaw),
            pitch: applyAngle(before.rotation.pitch, subcommand.pitch),
          }

          const stepId = `s${stepSerial++}`
          steps.push({
            id: stepId,
            branchId: current.branchId,
            parentStepId: current.tailStepId,
            index: subcommandIndex,
            subcommand,
            before,
            after,
          })

          nextContexts.push({
            branchId: current.branchId,
            tailStepId: stepId,
            state: after,
          })
          break
        }

        case 'facing_pos': {
          const after = cloneState(before)
          const facingFrom = getAnchorReferencePosition(before, context)
          const target = resolvePosition(before, subcommand.position)
          after.rotation = lookAtRotation(facingFrom, target, before.rotation)

          const stepId = `s${stepSerial++}`
          steps.push({
            id: stepId,
            branchId: current.branchId,
            parentStepId: current.tailStepId,
            index: subcommandIndex,
            subcommand,
            before,
            after,
          })

          nextContexts.push({
            branchId: current.branchId,
            tailStepId: stepId,
            state: after,
          })
          break
        }

        case 'facing_entity_feet':
        case 'facing_entity_eyes': {
          const targets = resolveEntities(context, subcommand.entity, before)
          if (targets.length === 0) {
            break
          }

          targets.forEach((target, targetIndex) => {
            const after = cloneState(before)
            const facingFrom = getAnchorReferencePosition(before, context)
            const facingTo = subcommand.kind === 'facing_entity_eyes' ? targetEyePosition(target) : target.position
            after.rotation = lookAtRotation(facingFrom, facingTo, before.rotation)

            const branchId =
              targets.length === 1 || targetIndex === 0 ? current.branchId : `b${branchSerial++}`
            const stepId = `s${stepSerial++}`

            steps.push({
              id: stepId,
              branchId,
              parentStepId: current.tailStepId,
              index: subcommandIndex,
              subcommand,
              before: cloneState(before),
              after,
            })

            nextContexts.push({
              branchId,
              tailStepId: stepId,
              state: after,
            })
          })
          break
        }
      }
    }

    contexts = nextContexts
  }

  return {
    ok: true,
    steps,
  }
}



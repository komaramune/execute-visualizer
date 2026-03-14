import {
  parseDistanceValue,
  parseSelectorCoordinateValue,
  parseTargetSelector,
  type NumericRange,
} from './entitySelector'
import type { CommandSourceState, ExecuteSubcommand, Vec3 } from '../types/execute'

export type SelectorBoxRange = {
  min: Vec3
  max: Vec3
}

export type SelectorVisualization = {
  origin: Vec3
  distance: NumericRange | null
  box: SelectorBoxRange | null
}

const getSelectorToken = (subcommand: ExecuteSubcommand): string | null => {
  switch (subcommand.kind) {
    case 'as':
    case 'at':
    case 'if_entity':
    case 'unless_entity':
    case 'positioned_as':
    case 'rotated_as':
    case 'facing_entity_feet':
    case 'facing_entity_eyes':
      return subcommand.entity
    default:
      return null
  }
}

const mergeDistanceRanges = (values: string[] | undefined): NumericRange | null => {
  if (!values || values.length === 0) {
    return null
  }

  let min: number | null = null
  let max: number | null = null

  for (const value of values) {
    const range = parseDistanceValue(value)
    if (!range) {
      return null
    }

    if (range.min !== null) {
      min = min === null ? range.min : Math.max(min, range.min)
    }
    if (range.max !== null) {
      max = max === null ? range.max : Math.min(max, range.max)
    }
  }

  if (min !== null && max !== null && min > max) {
    return null
  }

  return { min, max }
}

export const getSelectorVisualization = (
  subcommand: ExecuteSubcommand,
  currentState: CommandSourceState,
): SelectorVisualization | null => {
  const selectorToken = getSelectorToken(subcommand)
  if (!selectorToken) {
    return null
  }

  const parsedSelector = parseTargetSelector(selectorToken)
  if (!parsedSelector) {
    return null
  }

  const origin: Vec3 = {
    x: parsedSelector.args.x
      ? parseSelectorCoordinateValue(parsedSelector.args.x[parsedSelector.args.x.length - 1]) ?? currentState.position.x
      : currentState.position.x,
    y: parsedSelector.args.y
      ? parseSelectorCoordinateValue(parsedSelector.args.y[parsedSelector.args.y.length - 1]) ?? currentState.position.y
      : currentState.position.y,
    z: parsedSelector.args.z
      ? parseSelectorCoordinateValue(parsedSelector.args.z[parsedSelector.args.z.length - 1]) ?? currentState.position.z
      : currentState.position.z,
  }

  const distance = mergeDistanceRanges(parsedSelector.args.distance)
  const hasBoxArgument = Boolean(parsedSelector.args.dx || parsedSelector.args.dy || parsedSelector.args.dz)
  const box = hasBoxArgument
    ? (() => {
        const dx = parsedSelector.args.dx
          ? parseSelectorCoordinateValue(parsedSelector.args.dx[parsedSelector.args.dx.length - 1]) ?? 0
          : 0
        const dy = parsedSelector.args.dy
          ? parseSelectorCoordinateValue(parsedSelector.args.dy[parsedSelector.args.dy.length - 1]) ?? 0
          : 0
        const dz = parsedSelector.args.dz
          ? parseSelectorCoordinateValue(parsedSelector.args.dz[parsedSelector.args.dz.length - 1]) ?? 0
          : 0

        return {
          min: {
            x: Math.min(origin.x, origin.x + dx),
            y: Math.min(origin.y, origin.y + dy),
            z: Math.min(origin.z, origin.z + dz),
          },
          max: {
            x: Math.max(origin.x, origin.x + dx) + 1,
            y: Math.max(origin.y, origin.y + dy) + 1,
            z: Math.max(origin.z, origin.z + dz) + 1,
          },
        }
      })()
    : null

  if (!distance && !box) {
    return null
  }

  return {
    origin,
    distance,
    box,
  }
}

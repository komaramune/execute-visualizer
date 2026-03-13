import type { EntityState } from '../types/execute'
import { findSelectorTopLevelChar, splitSelectorTopLevel } from './selectorSyntax'

export type NumericRange = {
  min: number | null
  max: number | null
}

export type SelectorSort = 'nearest' | 'furthest' | 'random' | 'arbitrary'

export type ParsedTargetSelector = {
  target: 'e' | 's' | 'n' | 'p' | 'a' | 'r'
  args: Record<string, string[]>
}

export type SelectorMatchers = Record<
  string,
  (entity: EntityState, value: string) => boolean
>

const parseSelectorArgs = (content: string): Record<string, string[]> | null => {
  const trimmed = content.trim()
  if (trimmed.length === 0) {
    return {}
  }

  const args: Record<string, string[]> = {}
  const parts = splitSelectorTopLevel(trimmed, ',')
  if (!parts) {
    return null
  }

  const normalizedParts = parts.map((part) => part.trim())
  if (normalizedParts.length === 0) {
    return null
  }

  const trailingEmptyIndex = normalizedParts.length - 1
  for (let index = 0; index < normalizedParts.length; index += 1) {
    if (normalizedParts[index].length > 0) {
      continue
    }

    const isAllowedTrailingComma = index == trailingEmptyIndex
    if (!isAllowedTrailingComma) {
      return null
    }
  }

  const partsToParse = normalizedParts[trailingEmptyIndex].length === 0
    ? normalizedParts.slice(0, -1)
    : normalizedParts

  if (partsToParse.length === 0) {
    return null
  }

  for (const part of partsToParse) {
    const eqIndex = findSelectorTopLevelChar(part, '=')
    if (eqIndex <= 0 || eqIndex === part.length - 1) {
      return null
    }

    const key = part.slice(0, eqIndex).trim()
    const value = part.slice(eqIndex + 1).trim()
    if (key.length === 0 || value.length === 0) {
      return null
    }

    if (!args[key]) {
      args[key] = []
    }
    args[key].push(value)
  }

  return args
}


const parseRangeValue = (
  value: string,
  parseBound: (raw: string) => number | null,
): NumericRange | null => {
  if (value.includes('..')) {
    const [minRaw, maxRaw, ...rest] = value.split('..')
    if (rest.length > 0) {
      return null
    }

    const min = parseBound(minRaw)
    const max = parseBound(maxRaw)
    if ((minRaw.length > 0 && min === null) || (maxRaw.length > 0 && max === null)) {
      return null
    }
    if (min === null && max === null) {
      return null
    }
    if (min !== null && max !== null && min > max) {
      return null
    }
    return { min, max }
  }

  const exact = parseBound(value)
  if (exact === null) {
    return null
  }
  return { min: exact, max: exact }
}


export const parseDistanceValue = (value: string): NumericRange | null => {
  const parseBound = (raw: string): number | null => {
    if (raw.length === 0) {
      return null
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null
    }
    return parsed
  }

  return parseRangeValue(value, parseBound)
}

export const parseLimitValue = (value: string): number | null => {
  if (!/^\d+$/.test(value)) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null
  }

  return parsed
}

export const parseSortValue = (value: string): SelectorSort | null => {
  switch (value) {
    case 'nearest':
    case 'furthest':
    case 'random':
    case 'arbitrary':
      return value
    default:
      return null
  }
}

export const parseRotationValue = (value: string): NumericRange | null => {
  const parseBound = (raw: string): number | null => {
    if (raw.length === 0) {
      return null
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      return null
    }
    return parsed
  }

  return parseRangeValue(value, parseBound)
}

export const parseSelectorCoordinateValue = (value: string): number | null => {
  if (value.trim().length === 0) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const parseSelectorStringValue = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      return typeof parsed === 'string' ? parsed : trimmed.slice(1, -1)
    } catch {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

export const parseTargetSelector = (token: string): ParsedTargetSelector | null => {
  if (token.length < 2 || token[0] !== '@') {
    return null
  }

  const target = token[1] as 'e' | 's' | 'n' | 'p' | 'a' | 'r'
  if (!['e', 's', 'n', 'p', 'a', 'r'].includes(target)) {
    return null
  }

  if (token.length === 2) {
    return { target, args: {} }
  }

  if (token[2] !== '[' || token[token.length - 1] !== ']') {
    return null
  }

  const args = parseSelectorArgs(token.slice(3, -1))
  if (!args) {
    return null
  }

  return { target, args }
}

export const getDuplicateSelectorKeys = (
  selector: ParsedTargetSelector,
  nonRepeatableKeys: readonly string[],
): string[] => {
  const restricted = new Set(nonRepeatableKeys)
  return Object.entries(selector.args)
    .filter(([key, values]) => restricted.has(key) && values.length > 1)
    .map(([key]) => key)
}

export const getUnknownSelectorKeys = (
  selector: ParsedTargetSelector,
  supportedKeys: readonly string[],
): string[] => {
  const supported = new Set(supportedKeys)
  return Object.keys(selector.args).filter((key) => !supported.has(key))
}

export const matchesEntitySelector = (
  entity: EntityState,
  selector: ParsedTargetSelector,
  matchers: SelectorMatchers,
): boolean => {
  const entries = Object.entries(selector.args)
  for (const [key, values] of entries) {
    const matcher = matchers[key]
    if (!matcher) {
      return false
    }

    for (const value of values) {
      if (!matcher(entity, value)) {
        return false
      }
    }
  }

  return true
}

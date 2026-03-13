import type { EntityState } from '../types/execute'

export type EntityType = 'marker' | 'player' | 'other'

export type EntityPanel = {
  id: string
  name: string
  x: string
  y: string
  z: string
  yaw: string
  pitch: string
  height: string
  width: string
  eyeHeight: string
  entityType: EntityType
  tagsInput: string
  markerVisible: boolean
}

export type NumericField = 'x' | 'y' | 'z' | 'yaw' | 'pitch' | 'height' | 'width' | 'eyeHeight'
export type PositionField = 'x' | 'y' | 'z'

const DEFAULT_ENTITY_DIMENSIONS = {
  height: '1.8',
  width: '0.6',
  eyeHeight: '1.62',
} as const

const ZERO_ENTITY_DIMENSIONS = {
  height: '0',
  width: '0',
  eyeHeight: '0',
} as const

export const VIEW_TARGET_ENTITY_PREFIX = 'entity:'

export const normalizeNumericString = (raw: string): string => {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return '0'
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return '0'
  }
  const normalized = Object.is(parsed, -0) ? 0 : parsed
  return normalized.toString()
}

export const parseNumberOrZero = (raw: string): number => {
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? (Object.is(parsed, -0) ? 0 : parsed) : 0
}

const wrapIntoRange = (value: number, min: number, max: number): number => {
  const width = max - min
  if (!Number.isFinite(value) || width <= 0) {
    return min
  }

  let wrapped = ((value - min) % width + width) % width + min
  if (wrapped === min && value === max) {
    wrapped = max
  }
  return Object.is(wrapped, -0) ? 0 : wrapped
}

const normalizeAngleFieldString = (field: Extract<NumericField, 'yaw' | 'pitch'>, raw: string): string => {
  const normalized = parseNumberOrZero(raw)
  if (field === 'yaw') {
    return normalizeNumericString(wrapIntoRange(normalized, -180, 180).toString())
  }
  return normalizeNumericString(wrapIntoRange(normalized, -90, 90).toString())
}

const splitTagTokens = (input: string): string[] => {
  const tokens: string[] = []
  let current = ''
  let inQuotedString = false
  let escaping = false

  for (const char of input) {
    if (inQuotedString) {
      current += char
      if (escaping) {
        escaping = false
      } else if (char === '\\') {
        escaping = true
      } else if (char === '"') {
        inQuotedString = false
      }
      continue
    }

    if (char === ',') {
      tokens.push(current)
      current = ''
      continue
    }

    if (char === '"') {
      inQuotedString = true
    }

    current += char
  }

  tokens.push(current)
  return tokens
}

const getTagListBody = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('[')) {
    return trimmed
  }
  return trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed.slice(1)
}

const parseTagToken = (raw: string): string => {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return ''
  }

  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      return typeof parsed === 'string' ? parsed : trimmed.slice(1, -1)
    } catch {
      return trimmed.slice(1, -1)
    }
  }

  if (trimmed.startsWith('"') && !trimmed.endsWith('"')) {
    return trimmed.slice(1)
  }

  if (!trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(0, -1)
  }

  return trimmed
}

const parseTags = (raw: string): string[] => {
  const listBody = getTagListBody(raw)
  if (listBody.trim().length === 0) {
    return []
  }

  return splitTagTokens(listBody)
    .map((tag) => parseTagToken(tag))
    .filter((tag) => tag.length > 0)
}

const hasZeroDimensions = (panel: Pick<EntityPanel, 'height' | 'width' | 'eyeHeight'>): boolean =>
  normalizeNumericString(panel.height) === '0' &&
  normalizeNumericString(panel.width) === '0' &&
  normalizeNumericString(panel.eyeHeight) === '0'

export const normalizePanelFieldString = (field: NumericField, raw: string): string =>
  field === 'yaw' || field === 'pitch' ? normalizeAngleFieldString(field, raw) : normalizeNumericString(raw)

export const normalizeEntityDimensionFields = (
  heightRaw: string,
  widthRaw: string,
  eyeHeightRaw: string,
): Pick<EntityPanel, 'height' | 'width' | 'eyeHeight'> => {
  const height = normalizeNumericString(heightRaw)
  const width = normalizeNumericString(widthRaw)
  const maxEyeHeight = Math.max(parseNumberOrZero(height), 0)
  const eyeHeight = normalizeNumericString(
    Math.min(Math.max(parseNumberOrZero(eyeHeightRaw), 0), maxEyeHeight).toString(),
  )

  return {
    height,
    width,
    eyeHeight,
  }
}

export const applyEntityTypePreset = (panel: EntityPanel, entityType: EntityType): Partial<EntityPanel> => {
  if (entityType === 'marker') {
    return { entityType, ...ZERO_ENTITY_DIMENSIONS }
  }

  if (panel.entityType === 'marker' || hasZeroDimensions(panel)) {
    return { entityType, ...DEFAULT_ENTITY_DIMENSIONS }
  }

  return { entityType }
}

export const findViewTargetPanel = (selection: string, panels: EntityPanel[]): EntityPanel | null => {
  if (!selection.startsWith(VIEW_TARGET_ENTITY_PREFIX)) {
    return null
  }

  const raw = selection.slice(VIEW_TARGET_ENTITY_PREFIX.length)
  const panelById = panels.find((panel) => panel.id === raw)
  if (panelById) {
    return panelById
  }

  // Support older saved data that still stored entity targets by list index.
  const indexRaw = Number(raw)
  const index = Number.isFinite(indexRaw) ? Math.floor(indexRaw) : -1
  return index >= 0 ? panels[index] ?? null : null
}

export const normalizeViewTargetSelection = (selection: string, panels: EntityPanel[]): string => {
  if (selection === 'coords') {
    return 'coords'
  }

  const panel = findViewTargetPanel(selection, panels)
  return panel ? VIEW_TARGET_ENTITY_PREFIX + panel.id : 'coords'
}

export const createPanel = (id: string, name: string): EntityPanel => ({
  id,
  name,
  x: '0',
  y: '0',
  z: '0',
  yaw: '0',
  pitch: '0',
  ...ZERO_ENTITY_DIMENSIONS,
  entityType: 'marker',
  tagsInput: '',
  markerVisible: true,
})

export const createPanelId = (): string => {
  const randomId = globalThis.crypto?.randomUUID?.()
  if (randomId) {
    return `e-${randomId}`
  }

  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const createDefaultEntityName = (panels: readonly EntityPanel[]): string => {
  const usedNumbers = new Set<number>()
  for (const panel of panels) {
    const match = /^entity(\d+)$/.exec(panel.name.trim())
    if (!match) {
      continue
    }

    const parsed = Number(match[1])
    if (Number.isInteger(parsed) && parsed > 0) {
      usedNumbers.add(parsed)
    }
  }

  let nextNumber = 1
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1
  }

  return `entity${nextNumber}`
}

export const isEntityPanel = (value: unknown): value is EntityPanel =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value && typeof value.id === 'string' &&
  'name' in value && typeof value.name === 'string' &&
  'x' in value && typeof value.x === 'string' &&
  'y' in value && typeof value.y === 'string' &&
  'z' in value && typeof value.z === 'string' &&
  'yaw' in value && typeof value.yaw === 'string' &&
  'pitch' in value && typeof value.pitch === 'string' &&
  (!('height' in value) || typeof value.height === 'string') &&
  (!('width' in value) || typeof value.width === 'string') &&
  (!('eyeHeight' in value) || typeof value.eyeHeight === 'string') &&
  'entityType' in value && (value.entityType === 'marker' || value.entityType === 'player' || value.entityType === 'other') &&
  'tagsInput' in value && typeof value.tagsInput === 'string' &&
  'markerVisible' in value && typeof value.markerVisible === 'boolean'

export const hasUniqueEntityPanelIds = (panels: readonly EntityPanel[]): boolean => {
  const seen = new Set<string>()
  for (const panel of panels) {
    if (seen.has(panel.id)) {
      return false
    }
    seen.add(panel.id)
  }
  return true
}

export const hydrateEntityPanel = (panel: EntityPanel): EntityPanel => {
  const next: EntityPanel = {
    ...panel,
    height: typeof panel.height === 'string' ? panel.height : DEFAULT_ENTITY_DIMENSIONS.height,
    width: typeof panel.width === 'string' ? panel.width : DEFAULT_ENTITY_DIMENSIONS.width,
    eyeHeight: typeof panel.eyeHeight === 'string' ? panel.eyeHeight : DEFAULT_ENTITY_DIMENSIONS.eyeHeight,
    entityType: panel.entityType,
  }

  if (next.entityType === 'marker') {
    return { ...next, ...ZERO_ENTITY_DIMENSIONS }
  }

  return {
    ...next,
    ...normalizeEntityDimensionFields(next.height, next.width, next.eyeHeight),
  }
}

export const toEntityState = (panel: EntityPanel): EntityState => {
  const height = parseNumberOrZero(panel.height)
  const width = parseNumberOrZero(panel.width)
  const eyeHeight = Math.min(Math.max(parseNumberOrZero(panel.eyeHeight), 0), Math.max(height, 0))

  return {
    id: panel.id,
    name: panel.name.trim(),
    position: {
      x: parseNumberOrZero(panel.x),
      y: parseNumberOrZero(panel.y),
      z: parseNumberOrZero(panel.z),
    },
    rotation: {
      yaw: parseNumberOrZero(panel.yaw),
      pitch: parseNumberOrZero(panel.pitch),
    },
    tags: parseTags(panel.tagsInput),
    height,
    width,
    eyeHeight,
    entityType: panel.entityType,
  }
}

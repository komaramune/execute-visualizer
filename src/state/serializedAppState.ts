import {
  hasUniqueEntityPanelIds,
  hydrateEntityPanel,
  isEntityPanel,
  normalizeNumericString,
  normalizeViewTargetSelection,
  type EntityPanel,
} from '../entities/entityPanelState'
import type { Vec3 } from '../types/execute'

export type SerializedAppState = {
  version: 1
  command: string
  entityPanels: EntityPanel[]
  viewOptions: {
    markerSize: number
    markerOpacity: number
    targetSelection: string
    targetCoords: Vec3
    macroArgsInput: string
  }
  layout: {
    sidePanelWidth: number
    viewOptionsWidth: number
    commandPanelHeight: number
  }
  visibility: {
    hiddenStepIds: string[]
    hiddenRunBranchIds: string[]
  }
}

export type AppStateSnapshot = {
  command: string
  entityPanels: EntityPanel[]
  viewMarkerSize: number
  viewMarkerOpacity: number
  viewTargetSelection: string
  viewTargetCoords: Vec3
  macroArgsInput: string
  sidePanelWidth: number
  viewOptionsWidth: number
  commandPanelHeight: number
  hiddenStepIds: string[]
  hiddenRunBranchIds: string[]
}

export type RestoredAppState = {
  command: string
  entityPanels: EntityPanel[]
  viewMarkerSize: number
  viewMarkerOpacity: number
  viewTargetSelection: string
  viewTargetX: string
  viewTargetY: string
  viewTargetZ: string
  macroArgsInput: string
  sidePanelWidth: number
  viewOptionsWidth: number
  commandPanelHeight: number
  hiddenStepIds: string[]
  hiddenRunBranchIds: string[]
}

export type SerializedAppStateLimits = {
  maxMarkerSize: number
  minSidePanelWidth: number
  minViewOptionsWidth: number
  minCommandPanelHeight: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const isVec3 = (value: unknown): value is Vec3 =>
  isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.z)

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

export const createSerializedAppState = (snapshot: AppStateSnapshot): SerializedAppState => ({
  version: 1,
  command: snapshot.command,
  entityPanels: snapshot.entityPanels,
  viewOptions: {
    markerSize: snapshot.viewMarkerSize,
    markerOpacity: snapshot.viewMarkerOpacity,
    targetSelection: snapshot.viewTargetSelection,
    targetCoords: snapshot.viewTargetCoords,
    macroArgsInput: snapshot.macroArgsInput,
  },
  layout: {
    sidePanelWidth: snapshot.sidePanelWidth,
    viewOptionsWidth: snapshot.viewOptionsWidth,
    commandPanelHeight: snapshot.commandPanelHeight,
  },
  visibility: {
    hiddenStepIds: snapshot.hiddenStepIds,
    hiddenRunBranchIds: snapshot.hiddenRunBranchIds,
  },
})

export const parseSerializedAppState = (
  parsed: unknown,
  limits: SerializedAppStateLimits,
): RestoredAppState => {
  if (!isRecord(parsed)) {
    throw new Error('Invalid JSON root.')
  }

  const rawPanels = Array.isArray(parsed.entityPanels) ? parsed.entityPanels : null
  const viewOptions = isRecord(parsed.viewOptions) ? parsed.viewOptions : null
  const layout = isRecord(parsed.layout) ? parsed.layout : null
  const visibility = isRecord(parsed.visibility) ? parsed.visibility : null

  if (typeof parsed.command !== 'string' || !rawPanels || !viewOptions || !layout) {
    throw new Error('Missing required fields.')
  }

  if (!rawPanels.every(isEntityPanel)) {
    throw new Error('Invalid entity panel.')
  }

  const panels = rawPanels.map(hydrateEntityPanel)
  if (!hasUniqueEntityPanelIds(panels)) {
    throw new Error('Duplicate entity panel id.')
  }

  if (
    !isFiniteNumber(viewOptions.markerSize) ||
    !isFiniteNumber(viewOptions.markerOpacity) ||
    typeof viewOptions.targetSelection !== 'string' ||
    !isVec3(viewOptions.targetCoords) ||
    !isFiniteNumber(layout.sidePanelWidth) ||
    !isFiniteNumber(layout.viewOptionsWidth) ||
    !isFiniteNumber(layout.commandPanelHeight)
  ) {
    throw new Error('Invalid saved values.')
  }

  return {
    command: parsed.command,
    entityPanels: panels,
    viewMarkerSize: clamp(viewOptions.markerSize, 0, limits.maxMarkerSize),
    viewMarkerOpacity: clamp(viewOptions.markerOpacity, 0, 100),
    viewTargetSelection: normalizeViewTargetSelection(viewOptions.targetSelection, panels),
    viewTargetX: normalizeNumericString(viewOptions.targetCoords.x.toString()),
    viewTargetY: normalizeNumericString(viewOptions.targetCoords.y.toString()),
    viewTargetZ: normalizeNumericString(viewOptions.targetCoords.z.toString()),
    macroArgsInput: typeof viewOptions.macroArgsInput === 'string' ? viewOptions.macroArgsInput : '',
    sidePanelWidth: Math.max(limits.minSidePanelWidth, Math.round(layout.sidePanelWidth)),
    viewOptionsWidth: Math.max(limits.minViewOptionsWidth, Math.round(layout.viewOptionsWidth)),
    commandPanelHeight: Math.max(limits.minCommandPanelHeight, Math.round(layout.commandPanelHeight)),
    hiddenStepIds: toStringArray(visibility?.hiddenStepIds),
    hiddenRunBranchIds: toStringArray(visibility?.hiddenRunBranchIds),
  }
}

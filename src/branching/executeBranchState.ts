import type { CommandSourceState, ExecuteStep } from '../types/execute'

export type BranchRow = {
  branchId: string
  steps: ExecuteStep[]
}

export type RunMarkerState = {
  branchId: string
  state: CommandSourceState
}

export const ROOT_COMMAND_SOURCE_STATE: CommandSourceState = {
  executorId: null,
  position: { x: 0, y: 0, z: 0 },
  rotation: { yaw: -90, pitch: 0 },
  anchor: 'feet',
}

export const filterVisibleIds = (storedIds: string[], visibleIds: Iterable<string>): string[] => {
  const visibleIdSet = visibleIds instanceof Set ? visibleIds : new Set(visibleIds)
  return storedIds.filter((id) => visibleIdSet.has(id))
}

export const buildBranchRows = (displayedSteps: ExecuteStep[]): BranchRow[] => {
  if (displayedSteps.length === 0) {
    return []
  }

  const rowMap = new Map<string, ExecuteStep[]>()
  const firstSeenOrder = new Map<string, number>()
  const stepById = new Map<string, ExecuteStep>()

  displayedSteps.forEach((step) => {
    stepById.set(step.id, step)
  })

  displayedSteps.forEach((step) => {
    if (!rowMap.has(step.branchId)) {
      rowMap.set(step.branchId, [])
      firstSeenOrder.set(step.branchId, firstSeenOrder.size)
    }
    rowMap.get(step.branchId)!.push(step)
  })

  const parentByBranch = new Map<string, string | null>()
  const firstIndexByBranch = new Map<string, number>()
  for (const [branchId, steps] of rowMap.entries()) {
    const firstStep = steps[0]
    if (!firstStep || firstStep.parentStepId === null) {
      parentByBranch.set(branchId, null)
      firstIndexByBranch.set(branchId, -1)
      continue
    }

    const parentStep = stepById.get(firstStep.parentStepId)
    parentByBranch.set(branchId, parentStep ? parentStep.branchId : null)
    firstIndexByBranch.set(branchId, firstStep.index)
  }

  const childrenByBranch = new Map<string, string[]>()
  const roots: string[] = []

  for (const branchId of rowMap.keys()) {
    const parentBranchId = parentByBranch.get(branchId) ?? null
    if (!parentBranchId || parentBranchId === branchId || !rowMap.has(parentBranchId)) {
      roots.push(branchId)
      continue
    }

    const children = childrenByBranch.get(parentBranchId) ?? []
    children.push(branchId)
    childrenByBranch.set(parentBranchId, children)
  }

  const byFirstSeen = (a: string, b: string): number =>
    (firstSeenOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
    (firstSeenOrder.get(b) ?? Number.MAX_SAFE_INTEGER)

  const byTreeOrder = (a: string, b: string): number => {
    const indexDelta = (firstIndexByBranch.get(b) ?? -1) - (firstIndexByBranch.get(a) ?? -1)
    if (indexDelta !== 0) {
      return indexDelta
    }
    return byFirstSeen(a, b)
  }

  roots.sort(byFirstSeen)
  for (const children of childrenByBranch.values()) {
    children.sort(byTreeOrder)
  }

  const orderedBranchIds: string[] = []
  const visited = new Set<string>()

  const walk = (branchId: string) => {
    if (visited.has(branchId)) {
      return
    }
    visited.add(branchId)
    orderedBranchIds.push(branchId)

    const children = childrenByBranch.get(branchId) ?? []
    children.forEach((childId) => walk(childId))
  }

  roots.forEach((rootId) => walk(rootId))
  for (const branchId of rowMap.keys()) {
    if (!visited.has(branchId)) {
      walk(branchId)
    }
  }

  return orderedBranchIds.map((branchId) => ({
    branchId,
    steps: (rowMap.get(branchId) ?? []).sort((a, b) => a.index - b.index),
  }))
}

export const buildBranchLastStateMap = (branchRows: BranchRow[]): Map<string, CommandSourceState> => {
  const map = new Map<string, CommandSourceState>()
  branchRows.forEach((row) => {
    const last = row.steps[row.steps.length - 1]
    if (last) {
      map.set(row.branchId, last.after)
    }
  })
  return map
}

export const buildRunMarkerStates = (
  runTokenIndex: number,
  displayedStepCount: number,
  branchRows: BranchRow[],
  rootState: CommandSourceState,
): RunMarkerState[] => {
  if (runTokenIndex < 0) {
    return []
  }

  if (displayedStepCount === 0 || branchRows.length === 0) {
    return [{ branchId: 'root', state: rootState }]
  }

  return branchRows
    .map((row) => {
      const state = row.steps[row.steps.length - 1]?.after
      if (!state) {
        return null
      }
      return { branchId: row.branchId, state }
    })
    .filter((entry): entry is RunMarkerState => Boolean(entry))
}

export const collectHeaderHighlightedStepIds = (
  displayedSteps: ExecuteStep[],
  hoveringRoot: boolean,
  hoveredRowBranchId: string | null,
  hoveredColumnIndex: number | null,
): string[] => {
  if (displayedSteps.length === 0) {
    return []
  }

  if (hoveringRoot) {
    return displayedSteps.map((step) => step.id)
  }

  const ids = new Set<string>()

  if (hoveredRowBranchId) {
    displayedSteps
      .filter((step) => step.branchId === hoveredRowBranchId)
      .forEach((step) => ids.add(step.id))
  }

  if (hoveredColumnIndex !== null) {
    displayedSteps
      .filter((step) => step.index === hoveredColumnIndex)
      .forEach((step) => ids.add(step.id))
  }

  return Array.from(ids)
}

export const resolveHoveredState = (
  hoveringRoot: boolean,
  hoveredRunBranchId: string | null,
  hoveredStepId: string | null,
  displayedSteps: ExecuteStep[],
  branchLastStateMap: Map<string, CommandSourceState>,
  rootState: CommandSourceState,
): CommandSourceState | null => {
  if (hoveringRoot) {
    return rootState
  }
  if (hoveredRunBranchId) {
    return branchLastStateMap.get(hoveredRunBranchId) ?? rootState
  }
  if (hoveredStepId) {
    const step = displayedSteps.find((candidate) => candidate.id === hoveredStepId)
    return step ? step.after : null
  }
  return null
}

import type { MouseEvent as ReactMouseEvent } from 'react'

import type { BranchRow } from '../branching/executeBranchState'
import type { CommandSourceState, EntityState, ParseError } from '../types/execute'
import { colorForSubcommandKind, colorHexString } from '../viewer/subcommandColors'

type HoverTooltip = {
  x: number
  y: number
}

type CommandBranchTreeProps = {
  commandPanelHeight: number
  subcommandTexts: string[]
  branchRows: BranchRow[]
  runTokenIndex: number
  hiddenStepIds: string[]
  hiddenRunBranchIds: string[]
  hoveredStepId: string | null
  hoveredRunBranchId: string | null
  hoveredRowBranchId: string | null
  hoveredColumnIndex: number | null
  hoveringRunColumn: boolean
  hoveredState: CommandSourceState | null
  hoverTooltip: HoverTooltip | null
  allEntities: EntityState[]
  visibleParseError: ParseError | null
  onClearHoverState: () => void
  onSetHoveredStepId: (value: string | null) => void
  onSetHoveredRunBranchId: (value: string | null) => void
  onSetHoveredRowBranchId: (value: string | null) => void
  onSetHoveredColumnIndex: (value: number | null) => void
  onSetHoveringRunColumn: (value: boolean) => void
  onSetHoveringRoot: (value: boolean) => void
  onSetHoverTooltip: (value: HoverTooltip | null) => void
  onToggleAll: () => void
  onToggleColumnVisibility: (columnIndex: number) => void
  onToggleAllRunVisibility: () => void
  onToggleRowVisibility: (row: BranchRow) => void
  onToggleStepVisibility: (stepId: string) => void
  onToggleRunVisibility: (branchId: string) => void
}

const formatTooltipNumber = (value: number): string => value.toFixed(2)
const formatTooltipPosition = (state: CommandSourceState): string =>
  `${formatTooltipNumber(state.position.x)}, ${formatTooltipNumber(state.position.y)}, ${formatTooltipNumber(state.position.z)}`
const formatTooltipRotation = (state: CommandSourceState): string =>
  `yaw ${formatTooltipNumber(state.rotation.yaw)}, pitch ${formatTooltipNumber(state.rotation.pitch)}`
const formatTooltipExecutor = (state: CommandSourceState, entities: EntityState[]): string => {
  if (!state.executorId) {
    return 'none'
  }

  const executor = entities.find((entity) => entity.id === state.executorId)
  if (!executor) {
    return state.executorId
  }

  const name = executor.name.trim()
  return name.length > 0 ? name : executor.id
}

export const CommandBranchTree = ({
  commandPanelHeight,
  subcommandTexts,
  branchRows,
  runTokenIndex,
  hiddenStepIds,
  hiddenRunBranchIds,
  hoveredStepId,
  hoveredRunBranchId,
  hoveredRowBranchId,
  hoveredColumnIndex,
  hoveringRunColumn,
  hoveredState,
  hoverTooltip,
  allEntities,
  visibleParseError,
  onClearHoverState,
  onSetHoveredStepId,
  onSetHoveredRunBranchId,
  onSetHoveredRowBranchId,
  onSetHoveredColumnIndex,
  onSetHoveringRunColumn,
  onSetHoveringRoot,
  onSetHoverTooltip,
  onToggleAll,
  onToggleColumnVisibility,
  onToggleAllRunVisibility,
  onToggleRowVisibility,
  onToggleStepVisibility,
  onToggleRunVisibility,
}: CommandBranchTreeProps) => {
  const updateTooltip = (event: ReactMouseEvent<HTMLElement>) => {
    onSetHoverTooltip({ x: event.clientX + 8, y: event.clientY + 8 })
  }

  const handleRootHover = () => {
    onSetHoveringRoot(true)
    onSetHoveredStepId(null)
    onSetHoveredRunBranchId(null)
    onSetHoveredRowBranchId(null)
    onSetHoveredColumnIndex(null)
    onSetHoveringRunColumn(false)
  }

  const handleStepHover = (stepId: string) => {
    onSetHoveringRoot(false)
    onSetHoveredRunBranchId(null)
    onSetHoveredStepId(stepId)
    onSetHoveredRowBranchId(null)
    onSetHoveredColumnIndex(null)
    onSetHoveringRunColumn(false)
  }

  const handleRunHover = (branchId: string) => {
    onSetHoveringRoot(false)
    onSetHoveredStepId(null)
    onSetHoveredRunBranchId(branchId)
    onSetHoveredRowBranchId(null)
    onSetHoveredColumnIndex(null)
    onSetHoveringRunColumn(false)
  }

  return (
    <div className="command-preview" style={{ height: `${commandPanelHeight}px` }} onMouseLeave={onClearHoverState}>
      <div className="entity-head command-preview-head"><h2>Subcommand Branch Tree</h2></div>
      {subcommandTexts.length > 0 && branchRows.length > 0 && (
        <div className="branch-grid-wrap">
          <table
            className="branch-grid"
            onMouseMove={(event) => {
              const target = event.target as HTMLElement
              if (!target.closest('[data-step-hover]')) {
                onSetHoveredStepId(null)
              }
            }}
          >
            <thead>
              <tr>
                <th
                  className="grid-corner grid-head-cell"
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleAll()
                  }}
                  title="Toggle all markers"
                />
                <th className="grid-head-static" />
                {subcommandTexts.map((_, subcommandIndex) => (
                  <th
                    key={`col-${subcommandIndex}`}
                    className="grid-head-cell"
                    onMouseEnter={() => {
                      onSetHoveredStepId(null)
                      onSetHoveredColumnIndex(subcommandIndex)
                    }}
                    onMouseMove={() => {
                      onSetHoveredStepId(null)
                      onSetHoveredColumnIndex(subcommandIndex)
                    }}
                    onMouseLeave={() => onSetHoveredColumnIndex(null)}
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleColumnVisibility(subcommandIndex)
                    }}
                    title={`Toggle column ${subcommandIndex + 1}`}
                  >
                    {subcommandIndex + 1}
                  </th>
                ))}
                {runTokenIndex >= 0 && (
                  <th
                    className="grid-head-cell"
                    onMouseEnter={() => {
                      onSetHoveredStepId(null)
                      onSetHoveringRunColumn(true)
                    }}
                    onMouseMove={() => {
                      onSetHoveredStepId(null)
                      onSetHoveringRunColumn(true)
                    }}
                    onMouseLeave={() => onSetHoveringRunColumn(false)}
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleAllRunVisibility()
                    }}
                  />
                )}
              </tr>
            </thead>
            <tbody>
              {branchRows.map((row, rowIndex) => {
                const stepByIndex = new Map(row.steps.map((step) => [step.index, step]))
                const lastStepIndex = row.steps[row.steps.length - 1]?.index ?? -1
                const reachesRun = subcommandTexts.length === 0 || lastStepIndex === subcommandTexts.length - 1

                return (
                  <tr key={row.branchId}>
                    <th
                      className="grid-head-cell"
                      onMouseEnter={() => {
                        onSetHoveredStepId(null)
                        onSetHoveredRowBranchId(row.branchId)
                      }}
                      onMouseMove={() => {
                        onSetHoveredStepId(null)
                        onSetHoveredRowBranchId(row.branchId)
                      }}
                      onMouseLeave={() => onSetHoveredRowBranchId(null)}
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleRowVisibility(row)
                      }}
                      title={`Toggle row ${rowIndex + 1}`}
                    >
                      {rowIndex + 1}
                    </th>

                    <td>
                      {rowIndex === 0 ? (
                        <span className="command-group interactive" onMouseEnter={handleRootHover} onMouseMove={updateTooltip}>
                          execute
                        </span>
                      ) : (
                        <span className="command-group branch-label-placeholder" aria-hidden="true">
                          execute
                        </span>
                      )}
                    </td>

                    {subcommandTexts.map((stepText, subcommandIndex) => {
                      const step = stepByIndex.get(subcommandIndex)

                      if (!step) {
                        return (
                          <td key={`${row.branchId}-gap-${subcommandIndex}`}>
                            <span className="command-group placeholder">{stepText}</span>
                          </td>
                        )
                      }

                      const stepColor = colorHexString(colorForSubcommandKind(step.subcommand.kind))
                      const isHidden = hiddenStepIds.includes(step.id)
                      const isRowHovered = hoveredRowBranchId === row.branchId
                      const isColumnHovered = hoveredColumnIndex === subcommandIndex
                      const isHovered = step.id === hoveredStepId || isRowHovered || isColumnHovered

                      return (
                        <td key={step.id}>
                          <span
                            data-step-hover="true"
                            className={`command-group interactive${isHovered ? ' hovered' : ''}${isHidden ? ' hidden' : ''}`}
                            style={{ borderColor: stepColor }}
                            onMouseEnter={() => handleStepHover(step.id)}
                            onMouseMove={updateTooltip}
                            onMouseLeave={() => {
                              onSetHoveredStepId(null)
                            }}
                            onClick={(event) => {
                              event.stopPropagation()
                              onToggleStepVisibility(step.id)
                            }}
                          >
                            {stepText}
                          </span>
                        </td>
                      )
                    })}

                    {runTokenIndex >= 0 && (
                      <td>
                        {reachesRun ? (
                          <span
                            data-step-hover="true"
                            className={`command-group interactive${hoveredRunBranchId === row.branchId || hoveredRowBranchId === row.branchId || hoveringRunColumn ? ' hovered' : ''}${hiddenRunBranchIds.includes(row.branchId) ? ' hidden' : ''}`}
                            style={{ borderColor: '#ffffff' }}
                            onMouseEnter={() => handleRunHover(row.branchId)}
                            onMouseMove={updateTooltip}
                            onMouseLeave={() => {
                              onSetHoveredRunBranchId(null)
                            }}
                            onClick={(event) => {
                              event.stopPropagation()
                              onToggleRunVisibility(row.branchId)
                            }}
                          >
                            run
                          </span>
                        ) : (
                          <span className="command-group placeholder">run</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {hoveredState && hoverTooltip && (
        <div
          className="command-tooltip"
          style={{ left: hoverTooltip.x, top: hoverTooltip.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div>executor: {formatTooltipExecutor(hoveredState, allEntities)}</div>
          <div>position: {formatTooltipPosition(hoveredState)}</div>
          <div>rotation: {formatTooltipRotation(hoveredState)}</div>
        </div>
      )}

      {visibleParseError && (
        <div className="command-error-inline">
          Parse Error: {visibleParseError.message} (token {visibleParseError.tokenIndex})
        </div>
      )}
    </div>
  )
}

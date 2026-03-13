import { type MouseEvent as ReactMouseEvent } from 'react'

import {
  VIEW_TARGET_ENTITY_PREFIX,
  type EntityPanel,
  type PositionField,
} from '../entities/entityPanelState'
import { PanelCollapseButton } from './PanelCollapseButton'

type ViewOptionsPanelProps = {
  collapsed: boolean
  onToggleCollapsed: () => void
  maxMarkerSize: number
  markerSize: number
  markerOpacity: number
  targetSelection: string
  entityPanels: EntityPanel[]
  targetX: string
  targetY: string
  targetZ: string
  onMarkerSizeChange: (value: number) => void
  onMarkerOpacityChange: (value: number) => void
  onTargetSelectionChange: (value: string) => void
  onUpdateTargetField: (field: PositionField, value: string) => void
  onNormalizeTargetField: (field: PositionField) => void
  onStartTargetSpinDrag: (event: ReactMouseEvent<HTMLButtonElement>, field: PositionField) => void
}

type ViewTargetCoordFieldProps = {
  field: PositionField
  value: string
  onUpdateTargetField: ViewOptionsPanelProps['onUpdateTargetField']
  onNormalizeTargetField: ViewOptionsPanelProps['onNormalizeTargetField']
  onStartTargetSpinDrag: ViewOptionsPanelProps['onStartTargetSpinDrag']
}

const SpinDragIcon = () => (
  <svg className="spin-drag-icon" viewBox="0 0 12 16" aria-hidden="true">
    <path d="M6 2v12" />
    <path d="M3.5 4.5 6 2l2.5 2.5" />
    <path d="M3.5 11.5 6 14l2.5-2.5" />
  </svg>
)

const ViewTargetCoordField = ({
  field,
  value,
  onUpdateTargetField,
  onNormalizeTargetField,
  onStartTargetSpinDrag,
}: ViewTargetCoordFieldProps) => (
  <label className="viewer-coord-field">
    <span>{field}</span>
    <div className="spin-input-wrap">
      <input
        inputMode="decimal"
        value={value}
        onChange={(event) => onUpdateTargetField(field, event.target.value)}
        onBlur={() => onNormalizeTargetField(field)}
      />
      <button
        type="button"
        className="spin-drag-btn"
        onMouseDown={(event) => onStartTargetSpinDrag(event, field)}
        title={`Drag up/down to adjust ${field}`}
        aria-label={`Drag up/down to adjust ${field}`}
      >
        <SpinDragIcon />
      </button>
    </div>
  </label>
)

export const ViewOptionsPanel = ({
  collapsed,
  onToggleCollapsed,
  maxMarkerSize,
  markerSize,
  markerOpacity,
  targetSelection,
  entityPanels,
  targetX,
  targetY,
  targetZ,
  onMarkerSizeChange,
  onMarkerOpacityChange,
  onTargetSelectionChange,
  onUpdateTargetField,
  onNormalizeTargetField,
  onStartTargetSpinDrag,
}: ViewOptionsPanelProps) => (
  <section className="viewer-options-section">
    <div className="entity-head panel-toggle-head">
      <div className="panel-head-title">
        <h2>View Options</h2>
        <PanelCollapseButton axis="horizontal" collapsed={collapsed} onClick={onToggleCollapsed} />
      </div>
    </div>

    {!collapsed && (
      <div className="viewer-options-list entity-list">
        <label className="viewer-option-inline">
          <span>locator<br />size</span>
          <div className="viewer-slider-wrap">
            <input
              type="range"
              min={0}
              max={maxMarkerSize}
              step={1}
              value={markerSize}
              onChange={(event) => onMarkerSizeChange(Number(event.target.value))}
            />
            <output>{markerSize}</output>
          </div>
        </label>
        <label className="viewer-option-inline">
          <span>locator<br />opacity</span>
          <div className="viewer-slider-wrap">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={markerOpacity}
              onChange={(event) => onMarkerOpacityChange(Number(event.target.value))}
            />
            <output>{markerOpacity}</output>
          </div>
        </label>
        <label className="viewer-option-inline">
          <span>camera<br />target</span>
          <select value={targetSelection} onChange={(event) => onTargetSelectionChange(event.target.value)}>
            <option value="coords">X Y Z</option>
            {entityPanels.map((panel, index) => (
              <option key={panel.id} value={VIEW_TARGET_ENTITY_PREFIX + panel.id}>
                {panel.name.trim() || `entity${index + 1}`}
              </option>
            ))}
          </select>
        </label>
        {targetSelection === 'coords' && (
          <div className="viewer-coords-row">
            <ViewTargetCoordField
              field="x"
              value={targetX}
              onUpdateTargetField={onUpdateTargetField}
              onNormalizeTargetField={onNormalizeTargetField}
              onStartTargetSpinDrag={onStartTargetSpinDrag}
            />
            <ViewTargetCoordField
              field="y"
              value={targetY}
              onUpdateTargetField={onUpdateTargetField}
              onNormalizeTargetField={onNormalizeTargetField}
              onStartTargetSpinDrag={onStartTargetSpinDrag}
            />
            <ViewTargetCoordField
              field="z"
              value={targetZ}
              onUpdateTargetField={onUpdateTargetField}
              onNormalizeTargetField={onNormalizeTargetField}
              onStartTargetSpinDrag={onStartTargetSpinDrag}
            />
          </div>
        )}
      </div>
    )}
  </section>
)

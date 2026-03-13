import { type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from 'react'

import {
  applyEntityTypePreset,
  normalizeEntityDimensionFields,
  normalizeNumericString,
  normalizePanelFieldString,
  type EntityPanel,
  type EntityType,
  type NumericField,
} from '../entities/entityPanelState'

type EntityPanelCardProps = {
  panel: EntityPanel
  onHoverEnter: (id: string) => void
  onHoverLeave: (id: string) => void
  onReorderOver: (targetId: string) => void
  onDropOn: (targetId: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onUpdatePanel: (id: string, patch: Partial<EntityPanel>) => void
  onToggleMarkerVisibility: (id: string) => void
  onRemovePanel: (id: string) => void
  onStartSpinDrag: (event: ReactMouseEvent<HTMLButtonElement>, panel: EntityPanel, field: NumericField) => void
}

type EntitySpinFieldProps = {
  panel: EntityPanel
  field: NumericField
  label: string
  value: string
  title: string
  className?: string
  onChangeValue: (value: string) => void
  onBlurValue: () => void
  onStartSpinDrag: EntityPanelCardProps['onStartSpinDrag']
}

const SpinDragIcon = () => (
  <svg className="spin-drag-icon" viewBox="0 0 12 16" aria-hidden="true">
    <path d="M6 2v12" />
    <path d="M3.5 4.5 6 2l2.5 2.5" />
    <path d="M3.5 11.5 6 14l2.5-2.5" />
  </svg>
)

const DragDots = () => (
  <span className="drag-dots" aria-hidden="true">
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
  </span>
)

const EyeIcon = ({ visible }: { visible: boolean }) => (
  <svg className="icon-eye" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="2.8" />
    {!visible && <path d="M4 20 20 4" />}
  </svg>
)

const TrashIcon = () => (
  <svg className="icon-trash" viewBox="0 0 24 24" aria-hidden="true">
    <g transform="scale(0.6)">
      <path d="M8 11h1v22a3.003 3.003 0 0 0 3 3h16a3.003 3.003 0 0 0 3-3V11h1a1 1 0 0 0 0-2h-6V7a3.003 3.003 0 0 0-3-3h-6a3.003 3.003 0 0 0-3 3v2H8a1 1 0 0 0 0 2Zm8-4a1.001 1.001 0 0 1 1-1h6a1.001 1.001 0 0 1 1 1v2h-8Zm13 4v22a1.001 1.001 0 0 1-1 1H12a1.001 1.001 0 0 1-1-1V11Z" />
      <path d="M20 31a1 1 0 0 0 1-1V15a1 1 0 0 0-2 0v15a1 1 0 0 0 1 1Z" />
      <path d="M25 31a1 1 0 0 0 1-1V15a1 1 0 0 0-2 0v15a1 1 0 0 0 1 1Z" />
      <path d="M15 31a1 1 0 0 0 1-1V15a1 1 0 0 0-2 0v15a1 1 0 0 0 1 1Z" />
    </g>
  </svg>
)

const EntitySpinField = ({
  panel,
  field,
  label,
  value,
  title,
  className,
  onChangeValue,
  onBlurValue,
  onStartSpinDrag,
}: EntitySpinFieldProps) => (
  <label className={className}>
    <span>{label}</span>
    <div className="spin-input-wrap">
      <input inputMode="decimal" value={value} onChange={(event) => onChangeValue(event.target.value)} onBlur={onBlurValue} />
      <button
        type="button"
        className="spin-drag-btn"
        onMouseDown={(event) => onStartSpinDrag(event, panel, field)}
        title={title}
        aria-label={title}
      >
        <SpinDragIcon />
      </button>
    </div>
  </label>
)

export const EntityPanelCard = ({
  panel,
  onHoverEnter,
  onHoverLeave,
  onReorderOver,
  onDropOn,
  onDragStart,
  onDragEnd,
  onUpdatePanel,
  onToggleMarkerVisibility,
  onRemovePanel,
  onStartSpinDrag,
}: EntityPanelCardProps) => {
  const normalizeDimensions = () => onUpdatePanel(panel.id, normalizeEntityDimensionFields(panel.height, panel.width, panel.eyeHeight))

  const handleDragStart = (event: ReactDragEvent<HTMLButtonElement>) => {
    onDragStart(panel.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <section
      className="entity-card compact"
      onMouseEnter={() => onHoverEnter(panel.id)}
      onMouseLeave={() => onHoverLeave(panel.id)}
      onDragOver={(event) => {
        event.preventDefault()
        onReorderOver(panel.id)
      }}
      onDrop={() => onDropOn(panel.id)}
    >
      <div className="entity-row entity-row-top entity-row-top-fields">
        <button
          type="button"
          className="drag-handle"
          draggable
          onDragStart={handleDragStart}
          onDragEnd={onDragEnd}
          title="Drag to reorder"
        >
          <DragDots />
        </button>
        <label className="player-check">
          <span>type</span>
          <select
            value={panel.entityType}
            onChange={(event) => onUpdatePanel(panel.id, applyEntityTypePreset(panel, event.target.value as EntityType))}
          >
            <option value="marker">marker</option>
            <option value="player">player</option>
            <option value="other">other</option>
          </select>
        </label>

        <label className="field-inline field-main name-field">
          <span>name</span>
          <input value={panel.name} onChange={(event) => onUpdatePanel(panel.id, { name: event.target.value })} />
        </label>

        <label className="field-inline field-main tags-row">
          <span>tags</span>
          <input
            value={panel.tagsInput}
            onChange={(event) => onUpdatePanel(panel.id, { tagsInput: event.target.value })}
            placeholder="hoge, fuga"
          />
        </label>
      </div>

      <div className="entity-row entity-row-middle entity-row-middle-fields">
        <button
          type="button"
          className={`mini-btn toggle-btn${panel.markerVisible ? '' : ' off'}`}
          onClick={() => onToggleMarkerVisibility(panel.id)}
          title="Toggle marker visibility"
        >
          <EyeIcon visible={panel.markerVisible} />
        </button>
        <div className="field-cluster field-cluster-coords">
          <div className="pose-row entity-coords-row">
            <EntitySpinField
              panel={panel}
              field="x"
              label="x"
              value={panel.x}
              title="Drag up/down to adjust x"
              className="field-inline axis-field"
              onChangeValue={(value) => onUpdatePanel(panel.id, { x: value })}
              onBlurValue={() => onUpdatePanel(panel.id, { x: normalizeNumericString(panel.x) })}
              onStartSpinDrag={onStartSpinDrag}
            />
            <EntitySpinField
              panel={panel}
              field="y"
              label="y"
              value={panel.y}
              title="Drag up/down to adjust y"
              className="field-inline axis-field"
              onChangeValue={(value) => onUpdatePanel(panel.id, { y: value })}
              onBlurValue={() => onUpdatePanel(panel.id, { y: normalizeNumericString(panel.y) })}
              onStartSpinDrag={onStartSpinDrag}
            />
            <EntitySpinField
              panel={panel}
              field="z"
              label="z"
              value={panel.z}
              title="Drag up/down to adjust z"
              className="field-inline axis-field"
              onChangeValue={(value) => onUpdatePanel(panel.id, { z: value })}
              onBlurValue={() => onUpdatePanel(panel.id, { z: normalizeNumericString(panel.z) })}
              onStartSpinDrag={onStartSpinDrag}
            />
          </div>
        </div>

        <EntitySpinField
          panel={panel}
          field="eyeHeight"
          label="eyes"
          value={panel.eyeHeight}
          title="Drag up/down to adjust eye height"
          className="field-inline dimension-field eye-height-field"
          onChangeValue={(value) => onUpdatePanel(panel.id, { eyeHeight: value })}
          onBlurValue={normalizeDimensions}
          onStartSpinDrag={onStartSpinDrag}
        />
      </div>

      <div className="entity-row entity-row-bottom entity-row-bottom-fields">
        <button type="button" className="mini-btn danger delete-btn" onClick={() => onRemovePanel(panel.id)} title="Delete panel">
          <TrashIcon />
        </button>
        <div className="field-cluster field-cluster-rotation">
          <div className="pose-row entity-rotation-row">
            <EntitySpinField
              panel={panel}
              field="yaw"
              label="yaw"
              value={panel.yaw}
              title="Drag up/down to adjust yaw"
              className="field-inline"
              onChangeValue={(value) => onUpdatePanel(panel.id, { yaw: value })}
              onBlurValue={() => onUpdatePanel(panel.id, { yaw: normalizePanelFieldString('yaw', panel.yaw) })}
              onStartSpinDrag={onStartSpinDrag}
            />
            <EntitySpinField
              panel={panel}
              field="pitch"
              label="pitch"
              value={panel.pitch}
              title="Drag up/down to adjust pitch"
              className="field-inline"
              onChangeValue={(value) => onUpdatePanel(panel.id, { pitch: value })}
              onBlurValue={() => onUpdatePanel(panel.id, { pitch: normalizePanelFieldString('pitch', panel.pitch) })}
              onStartSpinDrag={onStartSpinDrag}
            />
          </div>
        </div>

        <div className="field-cluster field-cluster-size">
          <EntitySpinField
            panel={panel}
            field="height"
            label="height"
            value={panel.height}
            title="Drag up/down to adjust height"
            className="field-inline dimension-field"
            onChangeValue={(value) => onUpdatePanel(panel.id, { height: value })}
            onBlurValue={normalizeDimensions}
            onStartSpinDrag={onStartSpinDrag}
          />
          <EntitySpinField
            panel={panel}
            field="width"
            label="width"
            value={panel.width}
            title="Drag up/down to adjust width"
            className="field-inline dimension-field"
            onChangeValue={(value) => onUpdatePanel(panel.id, { width: value })}
            onBlurValue={normalizeDimensions}
            onStartSpinDrag={onStartSpinDrag}
          />
        </div>
      </div>
    </section>
  )
}

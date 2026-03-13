import { useEffect, useRef } from 'react'
import {
  AxesHelper,
  BufferGeometry,
  Color,
  GridHelper,
  Float32BufferAttribute,
  Group,
  Line,
  LineDashedMaterial,
  Material,
  Mesh,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Quaternion,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import type { CommandSourceState, EntityState, ExecuteStep, Vec3 } from '../types/execute'
import { colorForSubcommandKind } from './subcommandColors'

type RunMarkerState = {
  branchId: string
  state: CommandSourceState
}

type ViewerProps = {
  entity: EntityState
  entities: EntityState[]
  steps: ExecuteStep[]
  runStates: RunMarkerState[]
  highlightedStepId: string | null
  highlightedEntityId: string | null
  highlightedStepIds: string[]
  highlightedRunBranchId: string | null
  highlightedRunAll: boolean
  hiddenRunBranchIds: string[]
  hiddenStepIds: string[]
  markerSizeMultiplier: number
  markerOpacity: number
  cameraTarget: Vec3
}

type Runtime = {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  controls: OrbitControls
  markerRoot: Group
  axes: AxesHelper
  grid: GridHelper
  markerMeshes: Object3D[]
  pathLineMaterials: LineDashedMaterial[]
  arrowLineMaterials: LineMaterial[]
  lastCameraTarget: Vec3
}

const PYRAMID_HEIGHT = 0.2
const PYRAMID_RADIUS = 0.06

const PLAYER_COLOR = 0x4de1d8
const CONE_RADIUS = PYRAMID_RADIUS * 0.755
const ARROW_SHAFT_LENGTH = PYRAMID_HEIGHT * 0.34
const ARROW_HEAD_RADIUS = CONE_RADIUS * 0.8
const ARROW_HEAD_HEIGHT = PYRAMID_HEIGHT * 0.3
const ARROW_ROLL_OFFSET_RAD = Math.PI / 6
const PATH_GAP_SIZE = 0.002
const MARKER_LINE_WIDTH = 4
const ORIGIN_DOT_SIZE = MARKER_LINE_WIDTH * 2
const DEFAULT_MARKER_OPACITY = 0.5
const RUN_MARKER_COLOR = 0xffffff
const ENTITY_MARKER_COLOR = 0xff4d4d
const HITBOX_COLOR = 0x9aa3ad


const toThree = (v: Vec3): Vector3 => new Vector3(v.x, v.y, v.z)

const forwardFromRotation = (yaw: number, pitch: number): Vector3 => {
  const yawRad = (yaw * Math.PI) / 180
  const pitchRad = (pitch * Math.PI) / 180
  return new Vector3(
    -Math.sin(yawRad) * Math.cos(pitchRad),
    -Math.sin(pitchRad),
    Math.cos(yawRad) * Math.cos(pitchRad),
  ).normalize()
}


const quaternionFromYawPitch = (yaw: number, pitch: number): Quaternion => {
  const forward = forwardFromRotation(yaw, pitch)
  const yawRad = (yaw * Math.PI) / 180
  const horizontalForward = new Vector3(-Math.sin(yawRad), 0, Math.cos(yawRad)).normalize()

  const xAxis = horizontalForward.clone().cross(new Vector3(0, 1, 0)).normalize()
  const yAxis = forward
  const zAxis = xAxis.clone().cross(yAxis).normalize()

  const basis = new Matrix4().makeBasis(xAxis, yAxis, zAxis)
  return new Quaternion().setFromRotationMatrix(basis)
}


const disposeObject = (object: Object3D): void => {
  object.traverse((child) => {
    const maybeMesh = child as Mesh
    if (maybeMesh.geometry) {
      maybeMesh.geometry.dispose()
    }
    const material = (maybeMesh as { material?: Material | Material[] }).material
    if (Array.isArray(material)) {
      material.forEach((mat) => mat.dispose())
    } else {
      material?.dispose()
    }
  })
}

const clearGroup = (group: Group): void => {
  while (group.children.length > 0) {
    const child = group.children[0]
    group.remove(child)
    disposeObject(child)
  }
}

const createOriginDot = (color: number, opacity: number, size = ORIGIN_DOT_SIZE): Points => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3))
  const material = new PointsMaterial({
    color,
    size,
    sizeAttenuation: false,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  })
  const point = new Points(geometry, material)
  point.renderOrder = 23
  return point
}

const createPointMarker = (pos: Vec3, color: number, showHoverOutline = false, opacity = DEFAULT_MARKER_OPACITY): Group => {
  const marker = new Group()
  marker.position.copy(toThree(pos))

  if (showHoverOutline) {
    const outline = createOriginDot(0xffffff, opacity)
    outline.renderOrder = 21
    marker.add(outline)
  }

  const dot = createOriginDot(color, opacity)
  dot.renderOrder = 24
  marker.add(dot)
  return marker
}
type ArrowHeadStyle = 'single' | 'rightIsosceles'
type ArrowMarkerOptions = {
  pos: Vec3
  yaw: number
  pitch: number
  color: number
  showHoverOutline?: boolean
  headStyle?: ArrowHeadStyle
  rollOffsetRad?: number
  trimShaftAtHeadBase?: boolean
  offsetByTrimAmount?: boolean
  headRadius?: number
  headYOffset?: number
  headEndOffset?: { x: number; y: number; z: number }
  opacity?: number
}
const createLineMaterial = (color: number, linewidth: number, opacity: number): LineMaterial => {
  const material = new LineMaterial({
    color,
    linewidth,
    transparent: true,
    opacity,
    worldUnits: false,
    depthTest: false,
    depthWrite: false,
  })
  material.resolution.set(1, 1)
  return material
}
const createArrowMarker = ({
  pos,
  yaw,
  pitch,
  color,
  showHoverOutline = false,
  headStyle = 'single',
  rollOffsetRad = ARROW_ROLL_OFFSET_RAD,
  trimShaftAtHeadBase = false,
  offsetByTrimAmount = false,
  headRadius = ARROW_HEAD_RADIUS,
  headYOffset = 0,
  headEndOffset,
  opacity = DEFAULT_MARKER_OPACITY,
}: ArrowMarkerOptions): Group => {
  const origin = toThree(pos)
  const marker = new Group()
  const headBaseY = ARROW_SHAFT_LENGTH
  const tipY = ARROW_SHAFT_LENGTH + ARROW_HEAD_HEIGHT
  const yShift = trimShaftAtHeadBase && offsetByTrimAmount ? -headBaseY : 0
  const localHeadBaseY = headBaseY + yShift
  const localTipY = tipY + yShift
  const lineGeometry = new LineSegmentsGeometry()
  const headEndX = headEndOffset?.x ?? (-headRadius * 0.5)
  const headEndY = headEndOffset?.y ?? (localHeadBaseY + headYOffset)
  const headEndZ = headEndOffset?.z ?? ((Math.sqrt(3) * headRadius) / 2)
  const shaftStartY = (trimShaftAtHeadBase ? headBaseY : 0) + yShift
  const positions = [
    0, shaftStartY, 0,
    0, localTipY, 0,
  ]
  if (headStyle === 'rightIsosceles') {
    const headSize = ARROW_HEAD_HEIGHT * 0.5
    const leftX = -headSize
    const baseY = localTipY - headSize
    positions.push(
      0, localTipY, 0,
      leftX, baseY, 0,
      0, baseY, 0,
      leftX, baseY, 0,
    )

  } else if (headStyle === 'single') {
    positions.push(
      0, localTipY, 0,
      headEndX, headEndY, headEndZ,
    )
  }
  lineGeometry.setPositions(positions)
  const lineMaterials: LineMaterial[] = []
  if (showHoverOutline) {
    const outlineMaterial = createLineMaterial(0xffffff, 8, opacity)
    const outline = new LineSegments2(lineGeometry, outlineMaterial)
    outline.renderOrder = 21
    marker.add(outline)
    lineMaterials.push(outlineMaterial)
  }
  const lineMaterial = createLineMaterial(color, MARKER_LINE_WIDTH, opacity)
  const line = new LineSegments2(lineGeometry, lineMaterial)
  line.renderOrder = 22
  marker.add(line)
  marker.add(createOriginDot(color, opacity))
  lineMaterials.push(lineMaterial)
  marker.userData.arrowLineMaterials = lineMaterials
  marker.position.copy(origin)
  marker.quaternion.copy(quaternionFromYawPitch(yaw, pitch))
  marker.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rollOffsetRad))
  return marker
}
const createEntityMarker = (pos: Vec3, yaw: number, pitch: number, color: number, opacity: number, showHoverOutline = false): Group => {
  return createArrowMarker({
    pos,
    yaw,
    pitch,
    color,
    trimShaftAtHeadBase: true,
    offsetByTrimAmount: true,
    headStyle: 'single',
    headRadius: ARROW_HEAD_HEIGHT * 0.5,
    headYOffset: ARROW_HEAD_HEIGHT * 0.5,
    headEndOffset: {
      x: 0,
      y: ARROW_HEAD_HEIGHT * 0.5,
      z: ARROW_HEAD_HEIGHT * 0.5,
    },
    rollOffsetRad: 0,
    opacity,
    showHoverOutline,
  })
}
const createSubcommandMarker = (
  pos: Vec3,
  yaw: number,
  pitch: number,
  color: number,
  showHoverOutline = false,
  opacity = DEFAULT_MARKER_OPACITY,
): Group => {
  return createArrowMarker({
    pos,
    yaw,
    pitch,
    color,
    showHoverOutline,
    headStyle: 'rightIsosceles',
    rollOffsetRad: Math.PI / 2,
    trimShaftAtHeadBase: true,
    offsetByTrimAmount: true,
    opacity,
  })
}
const createHitboxMarker = (
  pos: Vec3,
  width: number,
  height: number,
  eyeHeight: number,
  color: number,
  opacity = DEFAULT_MARKER_OPACITY,
  highlighted = false,
): Group => {
  const marker = new Group()
  const halfWidth = Math.max(width, 0.001) / 2
  const hitboxHeight = Math.max(height, 0.001)
  const clampedEyeHeight = Math.min(Math.max(eyeHeight, 0), hitboxHeight)
  const geometry = new LineSegmentsGeometry()
  geometry.setPositions([
    -halfWidth, 0, -halfWidth, halfWidth, 0, -halfWidth,
    halfWidth, 0, -halfWidth, halfWidth, 0, halfWidth,
    halfWidth, 0, halfWidth, -halfWidth, 0, halfWidth,
    -halfWidth, 0, halfWidth, -halfWidth, 0, -halfWidth,
    -halfWidth, hitboxHeight, -halfWidth, halfWidth, hitboxHeight, -halfWidth,
    halfWidth, hitboxHeight, -halfWidth, halfWidth, hitboxHeight, halfWidth,
    halfWidth, hitboxHeight, halfWidth, -halfWidth, hitboxHeight, halfWidth,
    -halfWidth, hitboxHeight, halfWidth, -halfWidth, hitboxHeight, -halfWidth,
    -halfWidth, 0, -halfWidth, -halfWidth, hitboxHeight, -halfWidth,
    halfWidth, 0, -halfWidth, halfWidth, hitboxHeight, -halfWidth,
    halfWidth, 0, halfWidth, halfWidth, hitboxHeight, halfWidth,
    -halfWidth, 0, halfWidth, -halfWidth, hitboxHeight, halfWidth,
    -halfWidth, clampedEyeHeight, -halfWidth, halfWidth, clampedEyeHeight, -halfWidth,
    halfWidth, clampedEyeHeight, -halfWidth, halfWidth, clampedEyeHeight, halfWidth,
    halfWidth, clampedEyeHeight, halfWidth, -halfWidth, clampedEyeHeight, halfWidth,
    -halfWidth, clampedEyeHeight, halfWidth, -halfWidth, clampedEyeHeight, -halfWidth,
  ])

  const material = createLineMaterial(highlighted ? 0xffffff : color, highlighted ? MARKER_LINE_WIDTH + 1 : MARKER_LINE_WIDTH - 1, opacity)
  const lines = new LineSegments2(geometry, material)
  lines.renderOrder = 18
  marker.add(lines)
  marker.userData.arrowLineMaterials = [material]
  marker.position.copy(toThree(pos))
  return marker
}

const createRunMarker = (
  pos: Vec3,
  yaw: number,
  pitch: number,
  color: number,
  showHoverOutline = false,
  opacity = DEFAULT_MARKER_OPACITY,
): Group => {
  const origin = toThree(pos)
  const marker = new Group()
  const shaftLength = ARROW_HEAD_HEIGHT
  const arcRadius = shaftLength / 2
  const arcSegments = 10
  const shaftGeometry = new LineSegmentsGeometry()
  shaftGeometry.setPositions([
    0, 0, 0,
    0, shaftLength, 0,
  ])
  const arcPoints: number[] = []
  for (let i = 0; i <= arcSegments; i += 1) {
    const t = i / arcSegments
    const a = (Math.PI / 2) + (t * (Math.PI / 2))
    const x = Math.cos(a) * arcRadius
    const y = (shaftLength - arcRadius) + (Math.sin(a) * arcRadius)
    arcPoints.push(x, y, 0)
  }
  const arcGeometry = new LineGeometry()
  arcGeometry.setPositions(arcPoints)
  const lineMaterials: LineMaterial[] = []
  if (showHoverOutline) {
    const outlineMaterial = createLineMaterial(0xffffff, 8, opacity)
    const shaftOutline = new LineSegments2(shaftGeometry, outlineMaterial)
    shaftOutline.renderOrder = 21
    marker.add(shaftOutline)
    const arcOutline = new Line2(arcGeometry, outlineMaterial)
    arcOutline.computeLineDistances()
    arcOutline.renderOrder = 21
    marker.add(arcOutline)
    lineMaterials.push(outlineMaterial)
  }
  const lineMaterial = createLineMaterial(color, MARKER_LINE_WIDTH, opacity)
  const shaftLine = new LineSegments2(shaftGeometry, lineMaterial)
  shaftLine.renderOrder = 22
  marker.add(shaftLine)
  const arcLine = new Line2(arcGeometry, lineMaterial)
  arcLine.computeLineDistances()
  arcLine.renderOrder = 22
  marker.add(arcLine)
  marker.add(createOriginDot(color, opacity))
  lineMaterials.push(lineMaterial)
  marker.userData.arrowLineMaterials = lineMaterials
  marker.position.copy(origin)
  marker.quaternion.copy(quaternionFromYawPitch(yaw, pitch))
  marker.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2))
  return marker
}

const createDashedPath = (from: Vec3, to: Vec3, color: number): Line | null => {
  const a = toThree(from)
  const b = toThree(to)
  if (a.distanceTo(b) < 0.0001) {
    return null
  }

  const geometry = new BufferGeometry().setFromPoints([a, b])
  const lineMaterial = new LineDashedMaterial({ color, dashSize: PATH_GAP_SIZE, gapSize: PATH_GAP_SIZE })
  lineMaterial.depthTest = false
  lineMaterial.depthWrite = false
  const line = new Line(geometry, lineMaterial)
  line.renderOrder = 9
  line.computeLineDistances()
  return line
}

const bumpAxesOverGrid = (axes: AxesHelper): void => {
  const materials = Array.isArray(axes.material) ? axes.material : [axes.material]
  materials.forEach((mat) => {
    mat.depthTest = false
    mat.depthWrite = false
  })
  axes.renderOrder = 10
}

export function ThreeViewer({ entities, steps, runStates, highlightedStepId, highlightedEntityId, highlightedStepIds, highlightedRunBranchId, highlightedRunAll, hiddenRunBranchIds, hiddenStepIds, markerSizeMultiplier, markerOpacity, cameraTarget }: ViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<Runtime | null>(null)
  const markerSizeRef = useRef(markerSizeMultiplier)
  const initialCameraTargetRef = useRef(cameraTarget)
  useEffect(() => {
    markerSizeRef.current = markerSizeMultiplier
  }, [markerSizeMultiplier])

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }

    const initialCameraTarget = initialCameraTargetRef.current
    const scene = new Scene()
    scene.background = new Color(0x11141a)

    const camera = new PerspectiveCamera(60, 1, 0.1, 1500)
    camera.position.set(initialCameraTarget.x + 10, initialCameraTarget.y + 8, initialCameraTarget.z + 10)

    const renderer = new WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(initialCameraTarget.x, initialCameraTarget.y, initialCameraTarget.z)

    const grid = new GridHelper(128, 128, 0x4a5a6a, 0x2e3842)
    grid.position.set(initialCameraTarget.x, 0, initialCameraTarget.z)
    scene.add(grid)

    const axes = new AxesHelper(4)
    axes.position.set(initialCameraTarget.x, initialCameraTarget.y, initialCameraTarget.z)
    bumpAxesOverGrid(axes)
    scene.add(axes)

    const markerRoot = new Group()
    scene.add(markerRoot)

    runtimeRef.current = {
      scene,
      camera,
      renderer,
      controls,
      markerRoot,
      axes,
      grid,
      markerMeshes: [],
      pathLineMaterials: [],
      arrowLineMaterials: [],
      lastCameraTarget: { ...initialCameraTarget },
    }

    let resizeRaf = 0
    let lastWidth = 0
    let lastHeight = 0

    const applyResize = () => {
      const runtime = runtimeRef.current
      const hostEl = hostRef.current
      if (!runtime || !hostEl) {
        return
      }

      const rect = hostEl.getBoundingClientRect()
      const width = Math.max(Math.floor(rect.width), 2)
      const height = Math.max(Math.floor(rect.height), 2)

      if (width === lastWidth && height === lastHeight) {
        return
      }

      lastWidth = width
      lastHeight = height
      runtime.camera.aspect = width / height
      runtime.camera.updateProjectionMatrix()
      runtime.renderer.setSize(width, height, false)
      for (const material of runtime.arrowLineMaterials) {
        material.resolution.set(width, height)
      }
      runtime.renderer.render(runtime.scene, runtime.camera)
    }

    const scheduleResize = () => {
      if (resizeRaf !== 0) {
        window.cancelAnimationFrame(resizeRaf)
      }
      resizeRaf = window.requestAnimationFrame(() => {
        resizeRaf = 0
        applyResize()
      })
    }

    const ro = new ResizeObserver(() => scheduleResize())
    ro.observe(host)
    window.addEventListener('resize', scheduleResize)
    scheduleResize()

    let rafId = 0
    const animate = () => {
      const runtime = runtimeRef.current
      if (!runtime) {
        return
      }

      const zoomDistance = runtime.camera.position.distanceTo(runtime.controls.target)
      const markerScale = zoomDistance * 0.7 * Math.max(markerSizeRef.current, 0)
      for (const marker of runtime.markerMeshes) {
        const verticalScale = (marker.userData.verticalScale as number | undefined) ?? 1
        marker.scale.set(markerScale * verticalScale, markerScale, markerScale)
      }
      const dynamicGap = PATH_GAP_SIZE * markerScale
      for (const material of runtime.pathLineMaterials) {
        material.dashSize = dynamicGap
        material.gapSize = dynamicGap
      }

      runtime.controls.update()
      runtime.renderer.render(runtime.scene, runtime.camera)
      rafId = window.requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.cancelAnimationFrame(rafId)
      if (resizeRaf !== 0) {
        window.cancelAnimationFrame(resizeRaf)
      }
      ro.disconnect()
      window.removeEventListener('resize', scheduleResize)

      const runtime = runtimeRef.current
      if (runtime) {
        clearGroup(runtime.markerRoot)
        runtime.controls.dispose()
        runtime.renderer.dispose()
        if (host.contains(runtime.renderer.domElement)) {
          host.removeChild(runtime.renderer.domElement)
        }
      }
      runtimeRef.current = null
    }
  }, [])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) {
      return
    }

    const delta = {
      x: cameraTarget.x - runtime.lastCameraTarget.x,
      y: cameraTarget.y - runtime.lastCameraTarget.y,
      z: cameraTarget.z - runtime.lastCameraTarget.z,
    }

    if (delta.x !== 0 || delta.y !== 0 || delta.z !== 0) {
      const deltaVec = new Vector3(delta.x, delta.y, delta.z)
      runtime.camera.position.add(deltaVec)
      runtime.controls.target.add(deltaVec)
      runtime.lastCameraTarget = { ...cameraTarget }
    }

    runtime.grid.position.set(cameraTarget.x, 0, cameraTarget.z)
    runtime.axes.position.set(cameraTarget.x, cameraTarget.y, cameraTarget.z)

    clearGroup(runtime.markerRoot)
    runtime.markerMeshes = []
    runtime.pathLineMaterials = []
    runtime.arrowLineMaterials = []

    entities.forEach((currentEntity) => {
      const isEntityHighlighted = highlightedEntityId === currentEntity.id
      const shouldShowHitbox = currentEntity.entityType !== 'marker' && currentEntity.width > 0 && currentEntity.height > 0
      if (shouldShowHitbox) {
        const hitbox = createHitboxMarker(
          currentEntity.position,
          currentEntity.width,
          currentEntity.height,
          currentEntity.eyeHeight,
          HITBOX_COLOR,
          Math.min(markerOpacity * 0.8, 0.9),
          isEntityHighlighted,
        )
        runtime.markerRoot.add(hitbox)
        const hitboxLineMaterials = hitbox.userData.arrowLineMaterials as LineMaterial[] | undefined
        if (hitboxLineMaterials) {
          runtime.arrowLineMaterials.push(...hitboxLineMaterials)
        }
      }

      const marker = createEntityMarker(
        currentEntity.position,
        currentEntity.rotation.yaw,
        currentEntity.rotation.pitch,
        ENTITY_MARKER_COLOR,
        markerOpacity,
        isEntityHighlighted,
      )
      marker.userData.verticalScale = 0.5
      runtime.markerRoot.add(marker)
      runtime.markerMeshes.push(marker)
      const arrowLineMaterials = marker.userData.arrowLineMaterials as LineMaterial[] | undefined
      if (arrowLineMaterials) {
        runtime.arrowLineMaterials.push(...arrowLineMaterials)
      }
    })

    const stepById = new Map(steps.map((step) => [step.id, step]))
    const highlightedStepSet = new Set(highlightedStepIds)

    steps.forEach((step) => {
      if (hiddenStepIds.includes(step.id)) {
        return
      }

      const baseColor = colorForSubcommandKind(step.subcommand.kind)
      const markerColor = baseColor

      const prevStep = step.parentStepId ? stepById.get(step.parentStepId) : undefined
      const prevColor = prevStep ? colorForSubcommandKind(prevStep.subcommand.kind) : PLAYER_COLOR
      const isHighlighted = highlightedStepId === step.id || highlightedStepSet.has(step.id)
      const pathColor = isHighlighted ? 0xffffff : prevColor

      const path = createDashedPath(step.before.position, step.after.position, pathColor)
      if (path) {
        runtime.markerRoot.add(path)
        runtime.pathLineMaterials.push(path.material as LineDashedMaterial)
      }

      if (
        step.subcommand.kind === 'as' ||
        step.subcommand.kind === 'if_entity' ||
        step.subcommand.kind === 'if_unsupported' ||
        step.subcommand.kind === 'unless_entity' ||
        step.subcommand.kind === 'unless_unsupported' ||
        step.subcommand.kind === 'anchored'
      ) {
        const marker = createPointMarker(step.after.position, markerColor, isHighlighted, markerOpacity)
        marker.userData.verticalScale = 0.5
        runtime.markerRoot.add(marker)
        runtime.markerMeshes.push(marker)
        return
      }

      const marker = createSubcommandMarker(
        step.after.position,
        step.after.rotation.yaw,
        step.after.rotation.pitch,
        markerColor,
        isHighlighted,
        markerOpacity,
      )
      marker.userData.verticalScale = 0.5
      runtime.markerRoot.add(marker)
      runtime.markerMeshes.push(marker)
      const arrowLineMaterials = marker.userData.arrowLineMaterials as LineMaterial[] | undefined
      if (arrowLineMaterials) {
        runtime.arrowLineMaterials.push(...arrowLineMaterials)
      }
    })

    runStates.forEach((runState) => {
      if (hiddenRunBranchIds.includes(runState.branchId)) {
        return
      }
      const marker = createRunMarker(
        runState.state.position,
        runState.state.rotation.yaw,
        runState.state.rotation.pitch,
        RUN_MARKER_COLOR,
        highlightedRunAll || highlightedRunBranchId === runState.branchId,
        markerOpacity,
      )
      runtime.markerRoot.add(marker)
      runtime.markerMeshes.push(marker)
      const arrowLineMaterials = marker.userData.arrowLineMaterials as LineMaterial[] | undefined
      if (arrowLineMaterials) {
        runtime.arrowLineMaterials.push(...arrowLineMaterials)
      }
    })
    const size = runtime.renderer.getSize(new Vector2())
    for (const material of runtime.arrowLineMaterials) {
      material.resolution.set(size.x, size.y)
    }
  }, [cameraTarget, entities, steps, runStates, highlightedStepId, highlightedEntityId, highlightedStepIds, highlightedRunBranchId, highlightedRunAll, hiddenRunBranchIds, hiddenStepIds, markerOpacity])

  return <div className="viewer-canvas" ref={hostRef} />
}




































































































































































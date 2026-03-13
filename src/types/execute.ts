export type Vec3 = {
  x: number
  y: number
  z: number
}

export type Rotation = {
  yaw: number
  pitch: number
}

export type EntityKind = 'marker' | 'player' | 'other'

export type EntityState = {
  id: string
  name: string
  position: Vec3
  rotation: Rotation
  tags: string[]
  height: number
  width: number
  eyeHeight: number
  entityType: EntityKind
}

export type CoordinateToken =
  | {
      kind: 'absolute'
      raw: string
      value: number
    }
  | {
      kind: 'relative'
      raw: string
      value: number
    }
  | {
      kind: 'local'
      raw: string
      value: number
    }

export type AngleToken =
  | {
      kind: 'absolute'
      raw: string
      value: number
    }
  | {
      kind: 'relative'
      raw: string
      value: number
    }

export type PositionToken = {
  x: CoordinateToken
  y: CoordinateToken
  z: CoordinateToken
}

export type TokenRange = {
  start: number
  end: number
}

export type AlignAxis = 'x' | 'y' | 'z'
export type Anchor = 'feet' | 'eyes'

type SubcommandBase = {
  tokenRange: TokenRange
}

export type AsSubcommand = SubcommandBase & {
  kind: 'as'
  entity: string
}

export type AtSubcommand = SubcommandBase & {
  kind: 'at'
  entity: string
}

export type IfEntitySubcommand = SubcommandBase & {
  kind: 'if_entity'
  entity: string
}

export type IfUnsupportedSubcommand = SubcommandBase & {
  kind: 'if_unsupported'
  condition: string
}

export type UnlessEntitySubcommand = SubcommandBase & {
  kind: 'unless_entity'
  entity: string
}

export type UnlessUnsupportedSubcommand = SubcommandBase & {
  kind: 'unless_unsupported'
  condition: string
}

export type AlignSubcommand = SubcommandBase & {
  kind: 'align'
  axes: AlignAxis[]
}

export type AnchoredSubcommand = SubcommandBase & {
  kind: 'anchored'
  anchor: Anchor
}

export type PositionedPosSubcommand = SubcommandBase & {
  kind: 'positioned_pos'
  position: PositionToken
}

export type PositionedAsSubcommand = SubcommandBase & {
  kind: 'positioned_as'
  entity: string
}

export type RotatedAnglesSubcommand = SubcommandBase & {
  kind: 'rotated_angles'
  yaw: AngleToken
  pitch: AngleToken
}

export type RotatedAsSubcommand = SubcommandBase & {
  kind: 'rotated_as'
  entity: string
}

export type FacingPosSubcommand = SubcommandBase & {
  kind: 'facing_pos'
  position: PositionToken
}

export type FacingEntityFeetSubcommand = SubcommandBase & {
  kind: 'facing_entity_feet'
  entity: string
}

export type FacingEntityEyesSubcommand = SubcommandBase & {
  kind: 'facing_entity_eyes'
  entity: string
}

export type ExecuteSubcommand =
  | AsSubcommand
  | AtSubcommand
  | IfEntitySubcommand
  | IfUnsupportedSubcommand
  | UnlessEntitySubcommand
  | UnlessUnsupportedSubcommand
  | AlignSubcommand
  | AnchoredSubcommand
  | PositionedPosSubcommand
  | PositionedAsSubcommand
  | RotatedAnglesSubcommand
  | RotatedAsSubcommand
  | FacingPosSubcommand
  | FacingEntityFeetSubcommand
  | FacingEntityEyesSubcommand

export type ExecuteAst = {
  subcommands: ExecuteSubcommand[]
}

export type CommandSourceState = {
  executorId: string | null
  position: Vec3
  rotation: Rotation
  anchor: Anchor
}


export type ExecuteStep = {
  id: string
  branchId: string
  parentStepId: string | null
  index: number
  subcommand: ExecuteSubcommand
  before: CommandSourceState
  after: CommandSourceState
}

export type ParseError = {
  message: string
  tokenIndex: number
  token?: string
}

export type ParseSuccess = {
  ok: true
  ast: ExecuteAst
}

export type ParseFailure = {
  ok: false
  error: ParseError
}

export type ParseResult = ParseSuccess | ParseFailure

export type ExecuteContext = {
  entity?: EntityState
  entities: EntityState[]
}

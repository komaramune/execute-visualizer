import type { ExecuteSubcommand } from '../types/execute'

export const SUBCOMMAND_COLOR_MAP: Record<ExecuteSubcommand['kind'], number> = {
  as: 0xff9800,
  at: 0x4caf50,
  if_entity: 0x26a69a,
  if_unsupported: 0x26a69a,
  unless_entity: 0x4db6ac,
  unless_unsupported: 0x4db6ac,
  align: 0x8d6e63,
  anchored: 0x78909c,
  positioned_pos: 0x42a5f5,
  positioned_as: 0x1e88e5,
  rotated_angles: 0xfdd835,
  rotated_as: 0xfbc02d,
  facing_pos: 0xab47bc,
  facing_entity_feet: 0x8e24aa,
  facing_entity_eyes: 0x7b1fa2,
}

export const colorForSubcommandKind = (kind: ExecuteSubcommand['kind']): number =>
  SUBCOMMAND_COLOR_MAP[kind]

export const colorHexString = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

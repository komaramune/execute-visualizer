import type {
  AlignAxis,
  AngleToken,
  CoordinateToken,
  ExecuteAst,
  ExecuteContext,
  ExecuteSubcommand,
  ParseFailure,
  ParseResult,
  PositionToken,
} from '../types/execute'
import { getDuplicateSelectorKeys, getUnknownSelectorKeys, parseDistanceValue, parseLimitValue, parseRotationValue, parseSelectorCoordinateValue, parseSortValue, parseTargetSelector } from '../selectors/entitySelector'

const SUPPORTED_SELECTOR_KEYS = ['name', 'tag', 'distance', 'type', 'gamemode', 'team', 'scores', 'nbt', 'level', 'x_rotation', 'y_rotation', 'sort', 'limit', 'x', 'y', 'z', 'dx', 'dy', 'dz']
const EXECUTE_SUBCOMMAND_KEYWORDS = new Set(['as', 'at', 'if', 'unless', 'align', 'anchored', 'positioned', 'rotated', 'facing', 'in', 'summon', 'store'])

type Cursor = {
  tokens: string[]
  index: number
}

export type ParseProgressResult = {
  ast: ExecuteAst
  error?: ParseFailure['error']
}

export type TokenizedExecutePart = {
  text: string
  start: number
  end: number
}

const isParseFailure = (
  value: PositionToken | ParseFailure | ExecuteSubcommand,
): value is ParseFailure => 'ok' in value && !value.ok

const withRange = <T extends Omit<ExecuteSubcommand, 'tokenRange'>>(
  subcommand: T,
  start: number,
  cursor: Cursor,
): T & Pick<ExecuteSubcommand, 'tokenRange'> => ({
  ...subcommand,
  tokenRange: {
    start,
    end: cursor.index - 1,
  },
})

const fail = (message: string, tokenIndex: number, token?: string): ParseFailure => ({
  ok: false,
  error: {
    message,
    tokenIndex,
    token,
  },
})

const currentToken = (cursor: Cursor): string | undefined => cursor.tokens[cursor.index]

const selectorLooksIncomplete = (token: string): boolean =>
  token.startsWith('@') && (
    (token.includes('[') && !token.endsWith(']')) ||
    token.endsWith(',') ||
    token.endsWith('=')
  )

const consume = (cursor: Cursor): string | undefined => {
  const token = cursor.tokens[cursor.index]
  cursor.index += 1
  return token
}

const parseNumber = (token: string): number | null => {
  if (token.length === 0) {
    return null
  }
  const value = Number(token)
  return Number.isFinite(value) ? value : null
}

const parseCoordinateToken = (token: string): CoordinateToken | null => {
  if (token.startsWith('^')) {
    const raw = token.slice(1)
    const parsed = raw === '' ? 0 : parseNumber(raw)
    if (parsed === null) {
      return null
    }
    return {
      kind: 'local',
      raw: token,
      value: parsed,
    }
  }

  if (token.startsWith('~')) {
    const raw = token.slice(1)
    const parsed = raw === '' ? 0 : parseNumber(raw)
    if (parsed === null) {
      return null
    }
    return {
      kind: 'relative',
      raw: token,
      value: parsed,
    }
  }

  const parsed = parseNumber(token)
  if (parsed === null) {
    return null
  }
  return {
    kind: 'absolute',
    raw: token,
    value: parsed,
  }
}

const parseAlignAxes = (token: string): AlignAxis[] | null => {
  if (!/^[xyz]+$/.test(token)) {
    return null
  }

  const uniqueAxes = Array.from(new Set(token.split('')))
  if (uniqueAxes.length !== token.length) {
    return null
  }

  return uniqueAxes as AlignAxis[]
}

const parseAnchor = (token: string): 'feet' | 'eyes' | null => {
  if (token === 'feet' || token === 'eyes') {
    return token
  }
  return null
}

const parseAngleToken = (token: string): AngleToken | null => {
  if (token.startsWith('^')) {
    return null
  }

  if (token.startsWith('~')) {
    const raw = token.slice(1)
    const parsed = raw === '' ? 0 : parseNumber(raw)
    if (parsed === null) {
      return null
    }
    return {
      kind: 'relative',
      raw: token,
      value: parsed,
    }
  }

  const parsed = parseNumber(token)
  if (parsed === null) {
    return null
  }

  return {
    kind: 'absolute',
    raw: token,
    value: parsed,
  }
}

const parsePosition = (cursor: Cursor): PositionToken | ParseFailure => {
  const xIndex = cursor.index
  const xRaw = consume(cursor)
  const yRaw = consume(cursor)
  const zRaw = consume(cursor)

  if (!xRaw || !yRaw || !zRaw) {
    return fail('Expected 3 coordinates.', xIndex)
  }

  const x = parseCoordinateToken(xRaw)
  const y = parseCoordinateToken(yRaw)
  const z = parseCoordinateToken(zRaw)

  if (!x) {
    return fail(`Invalid coordinate token: ${xRaw}`, xIndex, xRaw)
  }
  if (!y) {
    return fail(`Invalid coordinate token: ${yRaw}`, xIndex + 1, yRaw)
  }
  if (!z) {
    return fail(`Invalid coordinate token: ${zRaw}`, xIndex + 2, zRaw)
  }

  const all = [x, y, z]
  const localCount = all.filter((token) => token.kind === 'local').length

  if (localCount > 0 && localCount < 3) {
    return fail('Local (^) coordinates must be used on all 3 axes.', xIndex)
  }

  return { x, y, z }
}

const consumeUnsupportedConditionRemainder = (cursor: Cursor): void => {
  while (cursor.index < cursor.tokens.length) {
    const token = currentToken(cursor)
    if (!token || token === 'run' || EXECUTE_SUBCOMMAND_KEYWORDS.has(token)) {
      return
    }
    consume(cursor)
  }
}

const INCOMPLETE_BOUNDARY_PARSE_MESSAGES = new Set([
  'Expected an if condition.',
  'Expected an unless condition.',
  'Expected an entity selector.',
  'Expected 3 coordinates.',
  'align requires one or more axes.',
  'rotated requires yaw and pitch.',
  "Expected 'eyes' or 'feet' after 'anchored'.",
  "Expected 'feet' or 'eyes' after 'facing entity <selector>'.",
  'Incomplete entity selector.',
])

const looksLikeSubcommandBoundary = (cursor: Cursor, context: ExecuteContext): boolean => {
  const token = currentToken(cursor)
  if (!token) {
    return true
  }
  if (token === 'run') {
    return true
  }
  if (!EXECUTE_SUBCOMMAND_KEYWORDS.has(token)) {
    return false
  }

  const probe: Cursor = { tokens: cursor.tokens, index: cursor.index }
  const parsed = parseSubcommand(probe, context)
  return !isParseFailure(parsed) || INCOMPLETE_BOUNDARY_PARSE_MESSAGES.has(parsed.error.message)
}

const consumeRequiredToken = (
  cursor: Cursor,
  context: ExecuteContext,
  message: string,
  tokenIndex = cursor.index,
): string | ParseFailure => {
  if (looksLikeSubcommandBoundary(cursor, context)) {
    return fail(message, tokenIndex, currentToken(cursor))
  }

  const token = consume(cursor)
  return token ? token : fail(message, tokenIndex)
}

const parseUnsupportedIfUnlessCondition = (
  cursor: Cursor,
  context: ExecuteContext,
  keyword: 'if' | 'unless',
  condition: string,
): ParseFailure | null => {
  const incompleteMessage = `Incomplete ${keyword} ${condition} condition.`

  const parseRequiredPosition = (): ParseFailure | null => {
    const positionIndex = cursor.index
    if (looksLikeSubcommandBoundary(cursor, context)) {
      return fail(incompleteMessage, positionIndex, currentToken(cursor))
    }

    const position = parsePosition(cursor)
    if (isParseFailure(position)) {
      if (position.error.message === 'Expected 3 coordinates.') {
        return fail(incompleteMessage, positionIndex, cursor.tokens[positionIndex])
      }
      return position
    }
    return null
  }

  const parseRequiredEntity = (): ParseFailure | null => {
    const entityIndex = cursor.index
    if (looksLikeSubcommandBoundary(cursor, context)) {
      return fail(incompleteMessage, entityIndex, currentToken(cursor))
    }

    const entity = parseEntityArg(cursor, context)
    if (typeof entity === 'string') {
      return null
    }

    if (entity.error.message === 'Expected an entity selector.' || entity.error.message === 'Incomplete entity selector.') {
      return fail(incompleteMessage, entityIndex, cursor.tokens[entityIndex])
    }

    return entity
  }

  switch (condition) {
    case 'block': {
      const positionError = parseRequiredPosition()
      if (positionError) {
        return positionError
      }
      const blockPredicate = consumeRequiredToken(cursor, context, incompleteMessage)
      return typeof blockPredicate === 'string' ? null : blockPredicate
    }

    case 'blocks': {
      const startError = parseRequiredPosition()
      if (startError) {
        return startError
      }
      const endError = parseRequiredPosition()
      if (endError) {
        return endError
      }
      const destinationError = parseRequiredPosition()
      if (destinationError) {
        return destinationError
      }
      const scanMode = consumeRequiredToken(cursor, context, incompleteMessage)
      return typeof scanMode === 'string' ? null : scanMode
    }

    case 'score': {
      const target = consumeRequiredToken(cursor, context, incompleteMessage)
      if (typeof target !== 'string') {
        return target
      }
      const targetObjective = consumeRequiredToken(cursor, context, incompleteMessage)
      if (typeof targetObjective !== 'string') {
        return targetObjective
      }
      const comparisonIndex = cursor.index
      const comparison = consumeRequiredToken(cursor, context, incompleteMessage, comparisonIndex)
      if (typeof comparison !== 'string') {
        return comparison
      }
      if (comparison === 'matches') {
        const range = consumeRequiredToken(cursor, context, incompleteMessage)
        return typeof range === 'string' ? null : range
      }
      if (!['=', '<', '<=', '>', '>='].includes(comparison)) {
        return fail(`Invalid score comparison token: ${comparison}`, comparisonIndex, comparison)
      }
      const source = consumeRequiredToken(cursor, context, incompleteMessage)
      if (typeof source !== 'string') {
        return source
      }
      const sourceObjective = consumeRequiredToken(cursor, context, incompleteMessage)
      return typeof sourceObjective === 'string' ? null : sourceObjective
    }

    case 'predicate':
    case 'dimension':
    case 'function': {
      const argument = consumeRequiredToken(cursor, context, incompleteMessage)
      return typeof argument === 'string' ? null : argument
    }

    case 'biome': {
      const positionError = parseRequiredPosition()
      if (positionError) {
        return positionError
      }
      const biome = consumeRequiredToken(cursor, context, incompleteMessage)
      return typeof biome === 'string' ? null : biome
    }

    case 'loaded': {
      return parseRequiredPosition()
    }

    case 'items': {
      const sourceKindIndex = cursor.index
      const sourceKind = consumeRequiredToken(cursor, context, incompleteMessage, sourceKindIndex)
      if (typeof sourceKind !== 'string') {
        return sourceKind
      }
      if (sourceKind === 'entity') {
        const entityError = parseRequiredEntity()
        if (entityError) {
          return entityError
        }
      } else if (sourceKind === 'block') {
        const positionError = parseRequiredPosition()
        if (positionError) {
          return positionError
        }
      } else {
        return fail(`Expected 'entity' or 'block' after '${keyword} items'.`, sourceKindIndex, sourceKind)
      }

      const slots = consumeRequiredToken(cursor, context, incompleteMessage)
      if (typeof slots !== 'string') {
        return slots
      }
      const itemPredicate = consumeRequiredToken(cursor, context, incompleteMessage)
      return typeof itemPredicate === 'string' ? null : itemPredicate
    }

    case 'data': {
      const sourceKindIndex = cursor.index
      const sourceKind = consumeRequiredToken(cursor, context, incompleteMessage, sourceKindIndex)
      if (typeof sourceKind !== 'string') {
        return sourceKind
      }
      if (sourceKind === 'entity') {
        const entityError = parseRequiredEntity()
        if (entityError) {
          return entityError
        }
      } else if (sourceKind === 'block') {
        const positionError = parseRequiredPosition()
        if (positionError) {
          return positionError
        }
      } else if (sourceKind === 'storage') {
        const storage = consumeRequiredToken(cursor, context, incompleteMessage)
        if (typeof storage !== 'string') {
          return storage
        }
      } else {
        return fail(`Expected 'entity', 'block' or 'storage' after '${keyword} data'.`, sourceKindIndex, sourceKind)
      }

      const pathToken = consumeRequiredToken(cursor, context, incompleteMessage)
      return typeof pathToken === 'string' ? null : pathToken
    }

    default: {
      const bodyStartIndex = cursor.index
      const firstToken = consumeRequiredToken(cursor, context, incompleteMessage, bodyStartIndex)
      if (typeof firstToken !== 'string') {
        return firstToken
      }
      consumeUnsupportedConditionRemainder(cursor)
      return null
    }
  }
}

const parseEntityArg = (cursor: Cursor, context: ExecuteContext): string | ParseFailure => {
  const entityIndex = cursor.index
  const selector = consume(cursor)
  if (!selector) {
    return fail('Expected an entity selector.', entityIndex)
  }

  const parsedSelector = parseTargetSelector(selector)
  if (!parsedSelector) {
    if (selectorLooksIncomplete(selector)) {
      return fail('Incomplete entity selector.', entityIndex, selector)
    }
    return fail("Expected '@s', '@s[...]', '@e', '@e[...]', '@n', '@n[...]', '@p', '@p[...]', '@a', '@a[...]', '@r' or '@r[...]'.", entityIndex, selector)
  }

  const duplicateKeys = getDuplicateSelectorKeys(parsedSelector, ['x', 'y', 'z', 'dx', 'dy', 'dz', 'sort', 'limit'])
  if (duplicateKeys.length > 0) {
    return fail(`Duplicate selector argument: ${duplicateKeys.join(', ')}`, entityIndex, selector)
  }

  const unknownKeys = getUnknownSelectorKeys(parsedSelector, SUPPORTED_SELECTOR_KEYS)
  if (unknownKeys.length > 0) {
    return fail(`Unsupported selector argument: ${unknownKeys.join(', ')}`, entityIndex, selector)
  }

  const invalidDistance = parsedSelector.args.distance?.find((value) => parseDistanceValue(value) === null)
  if (invalidDistance) {
    return fail(`Invalid distance selector value: ${invalidDistance}`, entityIndex, selector)
  }

  const invalidXRotation = parsedSelector.args.x_rotation?.find((value) => parseRotationValue(value) === null)
  if (invalidXRotation) {
    return fail(`Invalid x_rotation selector value: ${invalidXRotation}`, entityIndex, selector)
  }

  const invalidYRotation = parsedSelector.args.y_rotation?.find((value) => parseRotationValue(value) === null)
  if (invalidYRotation) {
    return fail(`Invalid y_rotation selector value: ${invalidYRotation}`, entityIndex, selector)
  }

  const invalidSort = parsedSelector.args.sort?.find((value) => parseSortValue(value) === null)
  if (invalidSort) {
    return fail(`Invalid sort selector value: ${invalidSort}`, entityIndex, selector)
  }

  const invalidLimit = parsedSelector.args.limit?.find((value) => parseLimitValue(value) === null)
  if (invalidLimit) {
    return fail(`Invalid limit selector value: ${invalidLimit}`, entityIndex, selector)
  }

  const invalidX = parsedSelector.args.x?.find((value) => parseSelectorCoordinateValue(value) === null)
  if (invalidX) {
    return fail(`Invalid x selector value: ${invalidX}`, entityIndex, selector)
  }

  const invalidY = parsedSelector.args.y?.find((value) => parseSelectorCoordinateValue(value) === null)
  if (invalidY) {
    return fail(`Invalid y selector value: ${invalidY}`, entityIndex, selector)
  }

  const invalidZ = parsedSelector.args.z?.find((value) => parseSelectorCoordinateValue(value) === null)
  if (invalidZ) {
    return fail(`Invalid z selector value: ${invalidZ}`, entityIndex, selector)
  }

  const invalidDx = parsedSelector.args.dx?.find((value) => parseSelectorCoordinateValue(value) === null)
  if (invalidDx) {
    return fail(`Invalid dx selector value: ${invalidDx}`, entityIndex, selector)
  }

  const invalidDy = parsedSelector.args.dy?.find((value) => parseSelectorCoordinateValue(value) === null)
  if (invalidDy) {
    return fail(`Invalid dy selector value: ${invalidDy}`, entityIndex, selector)
  }

  const invalidDz = parsedSelector.args.dz?.find((value) => parseSelectorCoordinateValue(value) === null)
  if (invalidDz) {
    return fail(`Invalid dz selector value: ${invalidDz}`, entityIndex, selector)
  }

  const candidates = [...context.entities]
  const contextEntity = context.entity
  if (contextEntity && !candidates.some((entity) => entity.name === contextEntity.name)) {
    candidates.push(contextEntity)
  }

  return selector
}
const parseSubcommand = (
  cursor: Cursor,
  context: ExecuteContext,
): ExecuteSubcommand | ParseFailure => {
  const keywordIndex = cursor.index
  const keyword = consume(cursor)

  if (!keyword) {
    return fail('Expected a subcommand.', keywordIndex)
  }

  switch (keyword) {
    case 'as': {
      const entity = parseEntityArg(cursor, context)
      if (typeof entity !== 'string') {
        return entity
      }
      return withRange({ kind: 'as', entity }, keywordIndex, cursor)
    }

    case 'at': {
      const entity = parseEntityArg(cursor, context)
      if (typeof entity !== 'string') {
        return entity
      }
      return withRange({ kind: 'at', entity }, keywordIndex, cursor)
    }

    case 'if': {
      const conditionIndex = cursor.index
      const condition = consume(cursor)
      if (!condition) {
        return fail("Expected an if condition.", conditionIndex)
      }
      if (condition !== 'entity') {
        const conditionError = parseUnsupportedIfUnlessCondition(cursor, context, 'if', condition)
        if (conditionError) {
          return conditionError
        }
        return withRange({ kind: 'if_unsupported', condition }, keywordIndex, cursor)
      }

      const entity = parseEntityArg(cursor, context)
      if (typeof entity !== 'string') {
        return entity
      }
      return withRange({ kind: 'if_entity', entity }, keywordIndex, cursor)
    }

    case 'unless': {
      const conditionIndex = cursor.index
      const condition = consume(cursor)
      if (!condition) {
        return fail("Expected an unless condition.", conditionIndex)
      }
      if (condition !== 'entity') {
        const conditionError = parseUnsupportedIfUnlessCondition(cursor, context, 'unless', condition)
        if (conditionError) {
          return conditionError
        }
        return withRange({ kind: 'unless_unsupported', condition }, keywordIndex, cursor)
      }

      const entity = parseEntityArg(cursor, context)
      if (typeof entity !== 'string') {
        return entity
      }
      return withRange({ kind: 'unless_entity', entity }, keywordIndex, cursor)
    }

    case 'align': {
      const axesIndex = cursor.index
      const axesRaw = consume(cursor)
      if (!axesRaw) {
        return fail('align requires one or more axes.', axesIndex)
      }

      const axes = parseAlignAxes(axesRaw)
      if (!axes) {
        return fail("align axes must be a combination of 'x', 'y' and 'z' without duplicates.", axesIndex, axesRaw)
      }

      return withRange({ kind: 'align', axes }, keywordIndex, cursor)
    }

    case 'anchored': {
      const anchorIndex = cursor.index
      const anchorRaw = consume(cursor)
      if (!anchorRaw) {
        return fail("Expected 'eyes' or 'feet' after 'anchored'.", anchorIndex)
      }

      const anchor = parseAnchor(anchorRaw)
      if (!anchor) {
        return fail("Expected 'eyes' or 'feet' after 'anchored'.", anchorIndex, anchorRaw)
      }

      return withRange({ kind: 'anchored', anchor }, keywordIndex, cursor)
    }

    case 'positioned': {
      if (currentToken(cursor) === 'as') {
        consume(cursor)
        const entity = parseEntityArg(cursor, context)
        if (typeof entity !== 'string') {
          return entity
        }
        return withRange({ kind: 'positioned_as', entity }, keywordIndex, cursor)
      }

      const position = parsePosition(cursor)
      if (isParseFailure(position)) {
        return position
      }
      return withRange({ kind: 'positioned_pos', position }, keywordIndex, cursor)
    }

    case 'rotated': {
      if (currentToken(cursor) === 'as') {
        consume(cursor)
        const entity = parseEntityArg(cursor, context)
        if (typeof entity !== 'string') {
          return entity
        }
        return withRange({ kind: 'rotated_as', entity }, keywordIndex, cursor)
      }

      const yawIndex = cursor.index
      const yawRaw = consume(cursor)
      const pitchRaw = consume(cursor)

      if (!yawRaw || !pitchRaw) {
        return fail('rotated requires yaw and pitch.', yawIndex)
      }

      const yaw = parseAngleToken(yawRaw)
      const pitch = parseAngleToken(pitchRaw)

      if (!yaw) {
        return fail(`Invalid yaw token: ${yawRaw}`, yawIndex, yawRaw)
      }
      if (!pitch) {
        return fail(`Invalid pitch token: ${pitchRaw}`, yawIndex + 1, pitchRaw)
      }

      return withRange({ kind: 'rotated_angles', yaw, pitch }, keywordIndex, cursor)
    }

    case 'facing': {
      if (currentToken(cursor) === 'entity') {
        consume(cursor)
        const entity = parseEntityArg(cursor, context)
        if (typeof entity !== 'string') {
          return entity
        }

        const anchorIndex = cursor.index
        const anchor = consume(cursor)
        if (!anchor) {
          return fail("Expected 'feet' or 'eyes' after 'facing entity <selector>'.", anchorIndex)
        }
        if (anchor !== 'feet' && anchor !== 'eyes') {
          return fail("Expected 'feet' or 'eyes' after 'facing entity <selector>'.", anchorIndex, anchor)
        }

        return withRange({ kind: anchor === 'eyes' ? 'facing_entity_eyes' : 'facing_entity_feet', entity }, keywordIndex, cursor)
      }

      const position = parsePosition(cursor)
      if (isParseFailure(position)) {
        return position
      }
      return withRange({ kind: 'facing_pos', position }, keywordIndex, cursor)
    }

    case 'in':
    case 'summon':
    case 'store':
      return fail(`Unsupported subcommand: ${keyword}`, keywordIndex, keyword)

    default:
      return fail(`Unsupported subcommand: ${keyword}`, keywordIndex, keyword)
  }
}

export const tokenizeExecuteWithRanges = (input: string): TokenizedExecutePart[] => {
  const tokens: TokenizedExecutePart[] = []
  let tokenStart = -1
  let bracketDepth = 0
  let quotedBy: string | null = null
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (quotedBy) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === quotedBy) {
        quotedBy = null
      }
      continue
    }

    if (/\s/.test(char) && bracketDepth === 0) {
      if (tokenStart >= 0) {
        tokens.push({
          text: input.slice(tokenStart, index),
          start: tokenStart,
          end: index,
        })
        tokenStart = -1
      }
      continue
    }

    if (tokenStart < 0) {
      tokenStart = index
    }

    if (char === '"' || char === "'") {
      quotedBy = char
      continue
    }

    if (char === '[') {
      bracketDepth += 1
    } else if (char === ']' && bracketDepth > 0) {
      bracketDepth -= 1
    }
  }

  if (tokenStart >= 0) {
    tokens.push({
      text: input.slice(tokenStart),
      start: tokenStart,
      end: input.length,
    })
  }

  return tokens
}

export const tokenizeExecute = (input: string): string[] =>
  tokenizeExecuteWithRanges(input).map((token) => token.text)

export const parseExecuteProgress = (input: string, context: ExecuteContext): ParseProgressResult => {
  const tokens = tokenizeExecute(input)
  const subcommands: ExecuteSubcommand[] = []

  if (tokens.length === 0) {
    return { ast: { subcommands } }
  }

  const cursor: Cursor = { tokens, index: 0 }

  if (currentToken(cursor) === 'execute') {
    consume(cursor)
  }

  while (cursor.index < tokens.length) {
    const token = currentToken(cursor)
    if (token === 'run') {
      return { ast: { subcommands } }
    }

    const parsed = parseSubcommand(cursor, context)
    if (isParseFailure(parsed)) {
      return {
        ast: { subcommands },
        error: parsed.error,
      }
    }

    subcommands.push(parsed)
  }

  return { ast: { subcommands } }
}

export const parseExecute = (input: string, context: ExecuteContext): ParseResult => {
  const progress = parseExecuteProgress(input, context)
  if (progress.error) {
    return {
      ok: false,
      error: progress.error,
    }
  }

  return {
    ok: true,
    ast: progress.ast,
  }
}






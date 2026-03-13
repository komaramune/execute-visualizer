import { tokenizeExecuteWithRanges } from '../parser/executeParser'

export type MacroArguments = Record<string, unknown>

export type MacroArgumentsParseResult =
  | { ok: true; value: MacroArguments }
  | { ok: false; error: string }

export type CommandMacroResult =
  | { ok: true; command: string }
  | { ok: false; error: string; tokenIndex: number; token: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringifyMacroValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value)
  }
  return JSON.stringify(value)
}

const isIdentifierStart = (char: string): boolean => /[A-Za-z_$]/.test(char)
const isIdentifierChar = (char: string): boolean => /[A-Za-z0-9_$-]/.test(char)
const isMacroPathSegmentChar = (char: string | undefined): boolean => typeof char === 'string' && /[A-Za-z0-9_-]/.test(char)
const MACRO_PATTERN = /\$\(([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)\)/g

const normalizeSingleQuotedStrings = (input: string): string => {
  let result = ''
  let index = 0
  let inDoubleString = false
  let escapingDouble = false

  while (index < input.length) {
    const char = input[index]

    if (inDoubleString) {
      result += char
      if (escapingDouble) {
        escapingDouble = false
      } else if (char === '\\') {
        escapingDouble = true
      } else if (char === '"') {
        inDoubleString = false
      }
      index += 1
      continue
    }

    if (char === '"') {
      inDoubleString = true
      result += char
      index += 1
      continue
    }

    if (char !== "'") {
      result += char
      index += 1
      continue
    }

    result += '"'
    index += 1

    while (index < input.length) {
      const current = input[index]
      if (current === '\\') {
        const next = input[index + 1]
        if (next === undefined) {
          result += '\\\\'
          index += 1
          continue
        }
        if (next === "'") {
          result += "'"
          index += 2
          continue
        }
        if (next === '"') {
          result += '\\"'
          index += 2
          continue
        }
        if (next === '\\') {
          result += '\\\\'
          index += 2
          continue
        }
        result += `\\${next}`
        index += 2
        continue
      }

      if (current === "'") {
        result += '"'
        index += 1
        break
      }
      if (current === '"') {
        result += '\\"'
        index += 1
        continue
      }
      if (current === '\n') {
        result += '\\n'
        index += 1
        continue
      }
      if (current === '\r') {
        result += '\\r'
        index += 1
        continue
      }
      if (current === '\t') {
        result += '\\t'
        index += 1
        continue
      }

      result += current
      index += 1
    }
  }

  return result
}

const quoteBareObjectKeys = (input: string): string => {
  let result = ''
  let index = 0
  let inString: '"' | null = null
  let escaping = false

  while (index < input.length) {
    const char = input[index]

    if (inString) {
      result += char
      if (escaping) {
        escaping = false
      } else if (char === '\\') {
        escaping = true
      } else if (char === inString) {
        inString = null
      }
      index += 1
      continue
    }

    if (char === '"') {
      inString = char
      result += char
      index += 1
      continue
    }

    const previousSignificantChar = result.trimEnd().slice(-1)
    if ((previousSignificantChar === '{' || previousSignificantChar === ',') && isIdentifierStart(char)) {
      let end = index + 1
      while (end < input.length && isIdentifierChar(input[end])) {
        end += 1
      }

      let cursor = end
      while (cursor < input.length && /\s/.test(input[cursor])) {
        cursor += 1
      }

      if (input[cursor] === ':') {
        result += `"${input.slice(index, end)}"`
        index = end
        continue
      }
    }

    result += char
    index += 1
  }

  return result
}

const stripTrailingCommas = (input: string): string => {
  let result = ''
  let index = 0
  let inString = false
  let escaping = false

  while (index < input.length) {
    const char = input[index]

    if (inString) {
      result += char
      if (escaping) {
        escaping = false
      } else if (char === '\\') {
        escaping = true
      } else if (char === '"') {
        inString = false
      }
      index += 1
      continue
    }

    if (char === '"') {
      inString = true
      result += char
      index += 1
      continue
    }

    if (char === ',') {
      let cursor = index + 1
      while (cursor < input.length && /\s/.test(input[cursor])) {
        cursor += 1
      }
      if (input[cursor] === '}' || input[cursor] === ']') {
        index += 1
        continue
      }
    }

    result += char
    index += 1
  }

  return result
}

const normalizeRelaxedMacroJson = (input: string): string =>
  stripTrailingCommas(quoteBareObjectKeys(normalizeSingleQuotedStrings(input)))

const tryParseMacroArguments = (input: string): MacroArgumentsParseResult => {
  try {
    const parsed: unknown = JSON.parse(input)
    if (!isRecord(parsed)) {
      return { ok: false, error: 'Macro arguments must be a JSON object.' }
    }
    return { ok: true, value: parsed }
  } catch {
    return { ok: false, error: 'Invalid macro arguments JSON.' }
  }
}

const getMacroValue = (args: MacroArguments, path: string): unknown => {
  let current: unknown = args
  for (const segment of path.split('.')) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index)) {
        return undefined
      }
      current = current[index]
      continue
    }
    if (isRecord(current)) {
      current = current[segment]
      continue
    }
    return undefined
  }
  return current
}

const findMacroToken = (command: string, offset: number) => {
  const tokens = tokenizeExecuteWithRanges(command)
  const tokenIndex = tokens.findIndex((token) => token.start <= offset && offset < token.end)
  if (tokenIndex >= 0) {
    return { tokenIndex, token: tokens[tokenIndex].text }
  }
  return {
    tokenIndex: Math.max(tokens.length - 1, 0),
    token: command.slice(offset).trim() || command,
  }
}

const findInvalidMacroPlaceholder = (
  command: string,
): { error: string; tokenIndex: number; token: string } | null => {
  for (let index = 1; index < command.length - 1; index += 1) {
    if (command[index] !== '$' || command[index + 1] !== '(') {
      continue
    }

    let cursor = index + 2
    if (!isMacroPathSegmentChar(command[cursor])) {
      const tokenInfo = findMacroToken(command, index)
      return {
        error: cursor >= command.length ? 'Incomplete macro placeholder.' : 'Invalid macro placeholder.',
        tokenIndex: tokenInfo.tokenIndex,
        token: tokenInfo.token,
      }
    }

    while (cursor < command.length && isMacroPathSegmentChar(command[cursor])) {
      cursor += 1
    }

    while (command[cursor] === '.') {
      cursor += 1
      if (!isMacroPathSegmentChar(command[cursor])) {
        const tokenInfo = findMacroToken(command, index)
        return {
          error: cursor >= command.length ? 'Incomplete macro placeholder.' : 'Invalid macro placeholder.',
          tokenIndex: tokenInfo.tokenIndex,
          token: tokenInfo.token,
        }
      }
      while (cursor < command.length && isMacroPathSegmentChar(command[cursor])) {
        cursor += 1
      }
    }

    if (command[cursor] === ')') {
      index = cursor
      continue
    }

    const tokenInfo = findMacroToken(command, index)
    return {
      error: cursor >= command.length ? 'Incomplete macro placeholder.' : 'Invalid macro placeholder.',
      tokenIndex: tokenInfo.tokenIndex,
      token: tokenInfo.token,
    }
  }

  return null
}

export const parseMacroArgumentsInput = (input: string): MacroArgumentsParseResult => {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return { ok: true, value: {} }
  }

  const directResult = tryParseMacroArguments(trimmed)
  if (directResult.ok || directResult.error === 'Macro arguments must be a JSON object.') {
    return directResult
  }

  return tryParseMacroArguments(normalizeRelaxedMacroJson(trimmed))
}

export const resolveCommandMacro = (command: string, args: MacroArguments): CommandMacroResult => {
  if (!command.startsWith('$')) {
    return { ok: true, command }
  }

  if (command.slice(1).trim().length === 0) {
    return { ok: false, error: 'Incomplete macro command.', tokenIndex: 0, token: '$' }
  }

  const invalidPlaceholder = findInvalidMacroPlaceholder(command)
  if (invalidPlaceholder) {
    return { ok: false, ...invalidPlaceholder }
  }

  const template = command.slice(1)

  let missingPath: string | null = null
  let missingToken = ''
  let missingOffset = -1
  const resolved = template.replace(MACRO_PATTERN, (match, path: string, offset: number) => {
    const value = getMacroValue(args, path)
    if (value === undefined) {
      if (missingPath === null) {
        missingPath = path
        missingToken = match
        missingOffset = offset + 1
      }
      return ''
    }
    return stringifyMacroValue(value)
  })

  if (missingPath) {
    return {
      ok: false,
      error: `Missing macro argument: ${missingPath}`,
      tokenIndex: findMacroToken(command, missingOffset).tokenIndex,
      token: missingToken,
    }
  }

  return { ok: true, command: resolved }
}

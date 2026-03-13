import { tokenizeExecuteWithRanges } from '../parser/executeParser'
import { findSelectorTopLevelChar, splitSelectorTopLevel } from '../selectors/selectorSyntax'

export type CommandCompletion = {
  label: string
  insertText: string
  detail?: string
}

export type CommandCompletionContext = {
  items: CommandCompletion[]
  rangeStart: number
  rangeEnd: number
}

export type CompletionEntityPanel = {
  name: string
  tagsInput: string
}

const TOP_LEVEL_COMPLETIONS: CommandCompletion[] = [
  { label: 'as', insertText: 'as' },
  { label: 'at', insertText: 'at' },
  { label: 'if', insertText: 'if' },
  { label: 'unless', insertText: 'unless' },
  { label: 'align', insertText: 'align' },
  { label: 'anchored', insertText: 'anchored' },
  { label: 'positioned', insertText: 'positioned' },
  { label: 'rotated', insertText: 'rotated' },
  { label: 'facing', insertText: 'facing' },
  { label: 'run', insertText: 'run' },
]

const angleTemplateCompletions = (): CommandCompletion[] => [
  { label: '~ ~', insertText: '~ ~' },
]

const alignTemplateCompletions = (): CommandCompletion[] => [
  { label: 'x', insertText: 'x' },
  { label: 'y', insertText: 'y' },
  { label: 'z', insertText: 'z' },
  { label: 'xy', insertText: 'xy' },
  { label: 'xz', insertText: 'xz' },
  { label: 'yz', insertText: 'yz' },
  { label: 'xyz', insertText: 'xyz' },
]

const dedupeCompletions = (items: CommandCompletion[]): CommandCompletion[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.label}::${item.insertText}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const filterCompletions = (items: CommandCompletion[], fragment: string): CommandCompletion[] => {
  const needle = fragment.trim().toLowerCase()
  if (needle.length === 0) {
    return items
  }

  return items.filter((item) =>
    item.label.toLowerCase().startsWith(needle) || item.insertText.trim().toLowerCase().startsWith(needle),
  )
}

const SELECTOR_ARGUMENT_KEYS = [
  'name',
  'tag',
  'distance',
  'x_rotation',
  'y_rotation',
  'sort',
  'limit',
  'x',
  'y',
  'z',
  'dx',
  'dy',
  'dz',
] as const

const selectorValueCompletions = (key: string, panels: CompletionEntityPanel[]): string[] => {
  switch (key) {
    case 'name':
      return panels
        .map((panel) => panel.name.trim())
        .filter((name) => name.length > 0)
    case 'tag':
      return Array.from(
        new Set(
          panels.flatMap((panel) =>
            panel.tagsInput
              .split(',')
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0),
          ),
        ),
      )
    case 'sort':
      return ['nearest', 'furthest', 'random', 'arbitrary']
    case 'limit':
      return ['1', '2', '3']
    default:
      return []
  }
}

const selectorTokenCompletions = (fragment: string, panels: CompletionEntityPanel[]): CommandCompletion[] => {
  const baseTargets: CommandCompletion[] = [
    { label: '@s', insertText: '@s' },
    { label: '@e', insertText: '@e' },
    { label: '@n', insertText: '@n' },
    { label: '@p', insertText: '@p' },
    { label: '@a', insertText: '@a' },
    { label: '@r', insertText: '@r' },
    { label: '@s[...]', insertText: '@s[' },
    { label: '@e[...]', insertText: '@e[' },
    { label: '@n[...]', insertText: '@n[' },
    { label: '@p[...]', insertText: '@p[' },
    { label: '@a[...]', insertText: '@a[' },
    { label: '@r[...]', insertText: '@r[' },
  ]

  if (!fragment.startsWith('@')) {
    return []
  }

  const match = /^@([esnpar])(?:\[(.*))?$/.exec(fragment)
  if (!match) {
    return filterCompletions(baseTargets, fragment)
  }

  const base = `@${match[1]}`
  const content = match[2]
  if (content === undefined) {
    return filterCompletions(baseTargets, fragment)
  }

  if (content.includes(']')) {
    return []
  }

  const parts = splitSelectorTopLevel(content, ',')
  if (!parts) {
    return []
  }

  const currentPartRaw = parts.pop() ?? ''
  const currentPart = currentPartRaw.trimStart()
  const committedParts = parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  const existingKeys = committedParts
    .map((part) => {
      const eqIndex = findSelectorTopLevelChar(part, '=')
      return eqIndex >= 0 ? part.slice(0, eqIndex).trim() : ''
    })
    .filter((value): value is string => Boolean(value))
  const prefix = `${base}[${committedParts.length > 0 ? `${committedParts.join(', ')}, ` : ''}`

  const eqIndex = findSelectorTopLevelChar(currentPart, '=')
  if (eqIndex < 0) {
    const availableKeys = SELECTOR_ARGUMENT_KEYS.filter((key) => key === 'tag' || !existingKeys.includes(key))
    return filterCompletions(
      availableKeys.map((key) => ({
        label: key,
        insertText: `${prefix}${key}=`,
      })),
      currentPart,
    )
  }

  const key = currentPart.slice(0, eqIndex).trim()
  const valueFragment = currentPart.slice(eqIndex + 1)
  if (key.length === 0) {
    return []
  }

  const values = selectorValueCompletions(key, panels)
  const availableKeys = SELECTOR_ARGUMENT_KEYS.filter((candidateKey) => candidateKey === 'tag' || (!existingKeys.includes(candidateKey) && candidateKey !== key))
  const matchedValue = values.find((value) => value === valueFragment)
  const hasTypedValue = valueFragment.trim().length > 0

  const suffixItemsForValue = (value: string): CommandCompletion[] => [
    { label: ']', insertText: `${prefix}${key}=${value}]` },
    ...(availableKeys.length > 0 ? [{ label: ', ', insertText: `${prefix}${key}=${value}, ` }] : []),
  ]

  if (matchedValue) {
    return suffixItemsForValue(matchedValue)
  }

  const valueItems = values.map((value) => ({
    label: value,
    insertText: `${prefix}${key}=${value}`,
  }))
  const filteredValueItems = filterCompletions(valueItems, valueFragment)
  if (!hasTypedValue) {
    return filteredValueItems
  }

  return dedupeCompletions([...suffixItemsForValue(valueFragment), ...filteredValueItems])
}

const selectorCompletions = (): CommandCompletion[] =>
  dedupeCompletions([
    { label: '@s', insertText: '@s' },
    { label: '@e', insertText: '@e' },
    { label: '@n', insertText: '@n' },
    { label: '@p', insertText: '@p' },
    { label: '@a', insertText: '@a' },
    { label: '@r', insertText: '@r' },
  ])

const coordinateTemplateCompletions = (): CommandCompletion[] => [
  { label: '~ ~ ~', insertText: '~ ~ ~' },
  { label: '^ ^ ^', insertText: '^ ^ ^' },
]

const topLevelCompletions = (): CommandCompletion[] => TOP_LEVEL_COMPLETIONS

const getExecuteCompletions = (tokens: string[]): CommandCompletion[] => {
  if (tokens.length === 0) {
    return [{ label: 'execute', insertText: 'execute' }]
  }

  if (tokens[0] !== 'execute') {
    return [{ label: 'execute', insertText: 'execute' }]
  }

  const body = tokens.slice(1)
  if (body.length === 0) {
    return topLevelCompletions()
  }

  let index = 0
  while (index < body.length) {
    const token = body[index]

    if (token === 'run') {
      return []
    }

    if (token === 'as' || token === 'at') {
      if (index + 1 >= body.length) {
        return selectorCompletions()
      }
      index += 2
      continue
    }

    if (token === 'if' || token === 'unless') {
      if (index + 1 >= body.length) {
        return [{ label: 'entity', insertText: 'entity' }]
      }
      if (body[index + 1] === 'entity') {
        if (index + 2 >= body.length) {
          return selectorCompletions()
        }
        index += 3
        continue
      }
      return [{ label: 'entity', insertText: 'entity' }]
    }

    if (token === 'align') {
      if (index + 1 >= body.length) {
        return alignTemplateCompletions()
      }
      index += 2
      continue
    }

    if (token === 'anchored') {
      if (index + 1 >= body.length) {
        return [
          { label: 'eyes', insertText: 'eyes' },
          { label: 'feet', insertText: 'feet' },
        ]
      }
      index += 2
      continue
    }

    if (token === 'positioned') {
      if (index + 1 >= body.length) {
        return [{ label: 'as', insertText: 'as' }, ...coordinateTemplateCompletions()]
      }
      if (body[index + 1] === 'as') {
        if (index + 2 >= body.length) {
          return selectorCompletions()
        }
        index += 3
        continue
      }

      const coordinateCount = body.length - (index + 1)
      if (coordinateCount < 3) {
        return coordinateTemplateCompletions()
      }
      index += 4
      continue
    }

    if (token === 'rotated') {
      if (index + 1 >= body.length) {
        return [{ label: 'as', insertText: 'as' }, ...angleTemplateCompletions()]
      }
      if (body[index + 1] === 'as') {
        if (index + 2 >= body.length) {
          return selectorCompletions()
        }
        index += 3
        continue
      }

      const angleCount = body.length - (index + 1)
      if (angleCount < 2) {
        return angleTemplateCompletions()
      }
      index += 3
      continue
    }

    if (token === 'facing') {
      if (index + 1 >= body.length) {
        return [{ label: 'entity', insertText: 'entity' }, ...coordinateTemplateCompletions()]
      }
      if (body[index + 1] === 'entity') {
        if (index + 2 >= body.length) {
          return selectorCompletions()
        }
        if (index + 3 >= body.length) {
          return [
            { label: 'feet', insertText: 'feet' },
            { label: 'eyes', insertText: 'eyes' },
          ]
        }
        index += 4
        continue
      }

      const coordinateCount = body.length - (index + 1)
      if (coordinateCount < 3) {
        return coordinateTemplateCompletions()
      }
      index += 4
      continue
    }

    return topLevelCompletions()
  }

  return topLevelCompletions()
}

export const getCommandCompletionContext = (
  input: string,
  cursor: number,
  panels: CompletionEntityPanel[],
): CommandCompletionContext => {
  const boundedCursor = Math.min(Math.max(cursor, 0), input.length)
  const tokens = tokenizeExecuteWithRanges(input)
  const activeToken = tokens.find((token) => token.start <= boundedCursor && boundedCursor <= token.end) ?? null
  const rangeStart = activeToken?.start ?? boundedCursor
  const rangeEnd = activeToken?.end ?? boundedCursor
  const fragment = activeToken ? input.slice(rangeStart, boundedCursor) : ''
  const completedTokens = tokens
    .filter((token) => token.end <= rangeStart)
    .map((token) => token.text)
  const baseItems = getExecuteCompletions(completedTokens)
  const expectsSelector = baseItems.some((item) => item.insertText.trimStart().startsWith('@'))
  const items = expectsSelector && fragment.startsWith('@')
    ? selectorTokenCompletions(fragment, panels)
    : filterCompletions(baseItems, fragment)

  return {
    items,
    rangeStart,
    rangeEnd,
  }
}

export const splitSelectorTopLevel = (content: string, separator: string): string[] | null => {
  const parts: string[] = []
  let start = 0
  let braceDepth = 0
  let bracketDepth = 0
  let parenDepth = 0
  let quotedBy: string | null = null
  let escaped = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]

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

    if (char === '"' || char === "'") {
      quotedBy = char
      continue
    }

    if (char === '{') {
      braceDepth += 1
      continue
    }
    if (char === '}') {
      if (braceDepth === 0) {
        return null
      }
      braceDepth -= 1
      continue
    }
    if (char === '[') {
      bracketDepth += 1
      continue
    }
    if (char === ']') {
      if (bracketDepth === 0) {
        return null
      }
      bracketDepth -= 1
      continue
    }
    if (char === '(') {
      parenDepth += 1
      continue
    }
    if (char === ')') {
      if (parenDepth === 0) {
        return null
      }
      parenDepth -= 1
      continue
    }

    if (
      char === separator &&
      braceDepth === 0 &&
      bracketDepth === 0 &&
      parenDepth === 0
    ) {
      parts.push(content.slice(start, index))
      start = index + 1
    }
  }

  if (quotedBy || escaped || braceDepth !== 0 || bracketDepth !== 0 || parenDepth !== 0) {
    return null
  }

  parts.push(content.slice(start))
  return parts
}

export const findSelectorTopLevelChar = (content: string, target: string): number => {
  let braceDepth = 0
  let bracketDepth = 0
  let parenDepth = 0
  let quotedBy: string | null = null
  let escaped = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]

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

    if (char === '"' || char === "'") {
      quotedBy = char
      continue
    }

    if (char === '{') {
      braceDepth += 1
      continue
    }
    if (char === '}') {
      if (braceDepth === 0) {
        return -1
      }
      braceDepth -= 1
      continue
    }
    if (char === '[') {
      bracketDepth += 1
      continue
    }
    if (char === ']') {
      if (bracketDepth === 0) {
        return -1
      }
      bracketDepth -= 1
      continue
    }
    if (char === '(') {
      parenDepth += 1
      continue
    }
    if (char === ')') {
      if (parenDepth === 0) {
        return -1
      }
      parenDepth -= 1
      continue
    }

    if (
      char === target &&
      braceDepth === 0 &&
      bracketDepth === 0 &&
      parenDepth === 0
    ) {
      return index
    }
  }

  return -1
}

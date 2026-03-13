import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const tryResolveWithExtensions = async (specifier, parentURL, nextResolve) => {
  const parentPath = fileURLToPath(parentURL)
  const parentDir = path.dirname(parentPath)

  for (const extension of ['.ts', '.tsx', '.js', '.mjs']) {
    const candidatePath = path.resolve(parentDir, `${specifier}${extension}`)
    try {
      await access(candidatePath)
      return nextResolve(pathToFileURL(candidatePath).href, { parentURL })
    } catch {
      // Try the next candidate extension.
    }
  }

  return null
}

export const resolve = async (specifier, context, nextResolve) => {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ERR_MODULE_NOT_FOUND' &&
      context.parentURL &&
      (specifier.startsWith('./') || specifier.startsWith('../'))
    ) {
      const resolved = await tryResolveWithExtensions(specifier, context.parentURL, nextResolve)
      if (resolved) {
        return resolved
      }
    }

    throw error
  }
}

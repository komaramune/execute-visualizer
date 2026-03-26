const normalizeBase = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return '/'
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

const DEFAULT_PROJECT_BASE = '/execute-visualizer/'

export const resolveGitHubPagesBase = (
  repository: string | undefined,
  explicitBase: string | undefined = undefined,
): string => {
  if (typeof explicitBase === 'string' && explicitBase.trim().length > 0) {
    return normalizeBase(explicitBase)
  }

  if (!repository) {
    return DEFAULT_PROJECT_BASE
  }

  const repoName = repository.split('/')[1] ?? ''
  if (repoName.length === 0 || repoName.toLowerCase().endsWith('.github.io')) {
    return '/'
  }

  return repoName === 'ExecuteVisualizer'
    ? DEFAULT_PROJECT_BASE
    : normalizeBase(repoName)
}

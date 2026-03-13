import assert from 'node:assert/strict'

import { resolveGitHubPagesBase } from '../src/deploy/githubPagesBase.ts'
import { defineTest } from './testHarness.ts'

export default [
  defineTest('resolveGitHubPagesBase uses the repository name for project pages', () => {
    assert.equal(resolveGitHubPagesBase('octocat/ExecuteVisualizer'), '/ExecuteVisualizer/')
  }),

  defineTest('resolveGitHubPagesBase returns root for user pages repositories', () => {
    assert.equal(resolveGitHubPagesBase('octocat/octocat.github.io'), '/')
  }),

  defineTest('resolveGitHubPagesBase prefers an explicit override', () => {
    assert.equal(resolveGitHubPagesBase('octocat/ExecuteVisualizer', 'custom/base'), '/custom/base/')
  }),
]

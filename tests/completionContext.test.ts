import { getCommandCompletionContext } from '../src/completions/executeCompletions.ts'
import type { TestCase } from './testHarness.ts'

const tests: TestCase[] = [
  {
    name: 'completion context only replaces text up to the cursor',
    run: () => {
      const input = 'execute a run'
      const cursor = 'execute a'.length
      const context = getCommandCompletionContext(input, cursor, [])
      const completion = context.items.find((item) => item.insertText === 'as')

      if (!completion) {
        throw new Error('expected as completion to be available')
      }

      const next = input.slice(0, context.rangeStart) + completion.insertText + input.slice(context.rangeEnd)
      if (next !== 'execute as run') {
        throw new Error(`unexpected completion result: ${next}`)
      }
    },
  },
  {
    name: 'completion context treats finished subcommands as completed tokens',
    run: () => {
      const context = getCommandCompletionContext('execute as', 'execute as'.length, [])
      const labels = context.items.map((item) => item.label)

      if (labels.includes('as')) {
        throw new Error('did not expect as to remain in suggestions after completing the token')
      }

      if (!labels.includes('@s')) {
        throw new Error('expected selector suggestions after execute as')
      }
    },
  },
  {
    name: 'completion context keeps selector tokens active at the end',
    run: () => {
      const context = getCommandCompletionContext('execute as @', 'execute as @'.length, [])
      const labels = context.items.map((item) => item.label)

      if (!labels.includes('@s')) {
        throw new Error('expected selector token suggestions while editing a selector')
      }
    },
  },
]

export default tests

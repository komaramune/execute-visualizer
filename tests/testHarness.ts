export type TestCase = {
  name: string
  run: () => void | Promise<void>
}

export const defineTest = (name: string, run: TestCase['run']): TestCase => ({ name, run })

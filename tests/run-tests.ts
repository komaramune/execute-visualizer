import entitySelectorTests from './entitySelector.test.ts'
import entityPanelStateTests from './entityPanelState.test.ts'
import executeParserTests from './executeParser.test.ts'
import executeSimulatorTests from './executeSimulator.test.ts'
import executeBranchStateTests from './executeBranchState.test.ts'
import githubPagesBaseTests from './githubPagesBase.test.ts'
import commandMacroTests from './commandMacro.test.ts'
import serializedAppStateTests from './serializedAppState.test.ts'
import selectorVisualizationTests from './selectorVisualization.test.ts'
import completionContextTests from './completionContext.test.ts'
import type { TestCase } from './testHarness.ts'

const tests: TestCase[] = [
  ...entitySelectorTests,
  ...entityPanelStateTests,
  ...executeParserTests,
  ...executeSimulatorTests,
  ...executeBranchStateTests,
  ...githubPagesBaseTests,
  ...commandMacroTests,
  ...serializedAppStateTests,
  ...selectorVisualizationTests,
  ...completionContextTests,
]

let failed = 0

for (const testCase of tests) {
  try {
    await testCase.run()
    console.log(`ok - ${testCase.name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${testCase.name}`)
    console.error(error)
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`)
  process.exit(1)
}

console.log(`\n${tests.length} test(s) passed.`)

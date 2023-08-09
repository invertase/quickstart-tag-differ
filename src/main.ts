/* eslint-disable no-console */
import * as core from '@actions/core'
import { DocTagDiff, extractDocTags, findDocTagDiffs } from './utils'
import * as github from '@actions/github'
import * as exec from '@actions/exec'

function getBaseRef(): string | undefined {
  return (
    core.getInput('base-ref') || github.context.payload.pull_request?.base.ref
  )
}

function assertBaseRef(baseRef?: string): asserts baseRef is string {
  if (!baseRef) {
    throw new Error(
      'Action should be run in pull request context or base-ref should be provided'
    )
  }
}

async function checkoutRef(ref: string, cwd: string): Promise<void> {
  await exec.exec('git', ['fetch', 'origin', ref], { cwd })
  await exec.exec('git', ['checkout', ref], { cwd })
  await exec.exec('git', ['pull'], { cwd })
}

async function run(): Promise<void> {
  try {
    core.setOutput('time', new Date().toTimeString())
    const extensions = core.getInput('extensions').split(',')

    const baseRef = getBaseRef()
    assertBaseRef(baseRef)

    const cwd = process.env['GITHUB_WORKSPACE'] || process.cwd()

    const baseRefTags = extractDocTags(cwd, extensions)

    const foo = await exec.getExecOutput('git', ['branch', '-v'])
    console.log(foo.stdout)

    await checkoutRef(baseRef, cwd)

    const currentRefTags = extractDocTags(cwd, extensions)

    const docTagDiffs = findDocTagDiffs(currentRefTags, baseRefTags)

    if (!github.context.payload.pull_request) {
      console.dir(JSON.stringify(docTagDiffs, null, 2))
      return
    }

    annotatePR(docTagDiffs)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()

function annotatePR(docTagDiffs: DocTagDiff[]): void {
  for (const docTag of docTagDiffs) {
    core.warning(getWarningMessage(docTag), getAnnotationProperties(docTag))
  }
}

function getWarningMessage(docTag: DocTagDiff): string | Error {
  const { type, changeType } = docTag

  // changeType should always be code_contents for added tags
  if (type === 'added' && changeType === 'code_contents') {
    return `Added doc tag ${docTag.tagName}`
  }

  // changeType should always be code_contents for removed tags
  if (type === 'removed' && changeType === 'code_contents') {
    return `Removed doc tag ${docTag.tagName}`
  }

  if (type === 'changed') {
    switch (changeType) {
      case 'code_contents':
        return `Changed code contents of doc tag ${docTag.tagName}`
      case 'file_path':
        return `File renamed containing doc tag ${docTag.tagName} to ${docTag.filePath}`
      case 'line_number':
        return `Line number changed for doc tag ${docTag.tagName} in file ${docTag.filePath}`
    }
  }

  return new Error(`Unknown type ${type} and changeType ${changeType}`)
}

function getAnnotationProperties(
  docTag: DocTagDiff
): core.AnnotationProperties | undefined {
  const file = docTag.filePath
  return {
    title: docTag.tagName,
    file,
    startLine: docTag.codeStartLine,
    endLine: docTag.codeEndLine
  }
}

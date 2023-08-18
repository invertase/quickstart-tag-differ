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

function annotatePR(docTagDiffs: DocTagDiff[]): void {
  for (const docTag of docTagDiffs) {
    const [title, message] = getTitleAndWarningMessage(docTag)
    core.warning(message, getAnnotationProperties(title, docTag))
  }
}

function getTitleAndWarningMessage(
  docTag: DocTagDiff
): [string, string | Error] {
  const { type, changeType } = docTag

  // changeType should always be code_contents for added tags
  if (type === 'added' && changeType === 'code_contents') {
    return ['New tag added', `Added doc tag ${docTag.tagName}`]
  }

  // changeType should always be code_contents for removed tags
  if (type === 'removed' && changeType === 'code_contents') {
    return ['Removed tag', `Removed doc tag ${docTag.tagName}`]
  }

  if (type === 'changed') {
    switch (changeType) {
      case 'code_contents':
        return [
          'Tag edited',
          `Changed code contents of doc tag ${docTag.tagName}`
        ]
      case 'file_path':
        return [
          'File renamed',
          `File renamed containing doc tag ${docTag.tagName} to ${docTag.filePath}`
        ]
      case 'line_number':
        return [
          'Tag moved',
          `Line number changed for doc tag ${docTag.tagName} in file ${docTag.filePath}`
        ]
    }
  }

  return [
    'Unknown error',
    new Error(`Unknown type ${type} and changeType ${changeType}`)
  ]
}

function getAnnotationProperties(
  titleOrError: string | Error,
  docTag: DocTagDiff
): core.AnnotationProperties | undefined {
  return {
    title: titleOrError.toString(),
    file: docTag.filePath,
    startLine: docTag.codeStartLine,
    endLine: docTag.codeEndLine
  }
}

async function run(): Promise<void> {
  try {
    const extensions = core.getInput('extensions').split(',')
    if (!extensions.length) {
      throw new Error('No extensions provided')
    }

    const baseRef = getBaseRef()
    assertBaseRef(baseRef)
    const cwd = process.env['GITHUB_WORKSPACE'] || process.cwd()

    const currentTags = extractDocTags(cwd, extensions)
    await checkoutRef(baseRef, cwd)
    const baseRefTags = extractDocTags(cwd, extensions)
    const docTagDiffs = findDocTagDiffs(baseRefTags, currentTags)

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

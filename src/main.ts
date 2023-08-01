/* eslint-disable no-console */
import * as core from '@actions/core'
import { extractDocTags, findDocTagDiffs } from './utils'
import github from '@actions/github'

async function run(): Promise<void> {
  try {
    const extensions = core.getInput('extensions').split(',')
    const token = core.getInput('github-token')
    const octokit = github.getOctokit(token)

    const currentRef = github.context.ref
    const baseRef = github.context.payload.pull_request?.base.ref

    console.log(`currentRef: ${currentRef}`)
    console.log(`baseRef: ${baseRef}`)

    // TODO head_ref and base_ref should be inputs from the action
    // TODO build 2 arrays and then diff the two
    const docTags1 = extractDocTags(
      `${process.cwd()}/quickstarts/quickstart-js`,
      extensions
    )
    const docTags2 = extractDocTags(
      `${process.cwd()}/quickstarts/quickstart-js`,
      extensions
    )
    console.dir(docTags1)
    // TODO currently will be empty since same directory
    const docTagDiffs = findDocTagDiffs(docTags1, docTags2)
    console.dir(docTagDiffs)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()

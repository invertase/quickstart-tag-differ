import * as fs from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import * as diff from 'diff'

interface DocTag {
  filePath: string
  codeStartLine: number
  codeEndLine: number
  codeContents: string
  tagName: string
}
interface DocTagDiff {
  filePath: string
  tagName: string
  changeType: 'file_path' | 'line_number' | 'code_contents'
  codeContentsDiff?: string
  type: 'added' | 'removed' | 'changed'
}
function createDocTagDiff(oldTag: DocTag, newTag: DocTag): DocTagDiff[] {
  const diffs: DocTagDiff[] = []
  if (oldTag.filePath !== newTag.filePath) {
    diffs.push({
      filePath: newTag.filePath,
      tagName: newTag.tagName,
      changeType: 'file_path',
      type: 'changed'
    })
  }
  if (
    oldTag.codeStartLine !== newTag.codeStartLine ||
    oldTag.codeEndLine !== newTag.codeEndLine
  ) {
    diffs.push({
      filePath: newTag.filePath,
      tagName: newTag.tagName,
      changeType: 'line_number',
      type: 'changed'
    })
  }
  if (oldTag.codeContents !== newTag.codeContents) {
    diffs.push({
      filePath: newTag.filePath,
      tagName: newTag.tagName,
      changeType: 'code_contents',
      codeContentsDiff: diff.createTwoFilesPatch(
        oldTag.filePath,
        newTag.filePath,
        oldTag.codeContents,
        newTag.codeContents
      ),
      type: 'changed'
    })
  }
  return diffs
}
const DOC_TAG_START_REGEX = /\[START ([^\]]+)\]/
const DOC_TAG_END_REGEX = /\[END ([^\]]+)\]/
function findFilesInDirectory(
  directory: string,
  extensions: string[]
): string[] {
  const filePatterns = extensions.map(ext => `**/*.${ext}`)
  return glob.sync(`{${filePatterns.join(',')}}`, { cwd: directory })
}
function processFile(filePath: string): DocTag[] {
  const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n')
  const docTags: DocTag[] = []
  let currentTag: Partial<DocTag> = {}

  // eslint-disable-next-line github/array-foreach
  fileLines.forEach((line, index) => {
    const startMatch = line.match(DOC_TAG_START_REGEX)
    const endMatch = line.match(DOC_TAG_END_REGEX)
    if (startMatch) {
      currentTag = {
        filePath,
        codeStartLine: index + 1,
        tagName: startMatch[1],
        codeContents: ''
      }
    } else if (endMatch && currentTag.tagName === endMatch[1]) {
      currentTag.codeEndLine = index + 1
      currentTag.codeContents = currentTag.codeContents?.trim()
      docTags.push(currentTag as DocTag)
      currentTag = {}
    } else if (currentTag.codeStartLine) {
      currentTag.codeContents += `${line}\n`
    }
  })
  if (currentTag.codeStartLine && !currentTag.codeEndLine) {
    throw new Error(
      `Missing end tag for start tag in file ${filePath} at line ${currentTag.codeStartLine}`
    )
  }
  return docTags
}

export function extractDocTags(
  directory: string,
  extensions: string[]
): DocTag[] {
  const files = findFilesInDirectory(directory, extensions)
  let docTags: DocTag[] = []
  for (const file of files) {
    docTags = docTags.concat(processFile(path.join(directory, file)))
  }
  return docTags
}

export function findDocTagDiffs(
  oldTags: DocTag[],
  newTags: DocTag[]
): DocTagDiff[] {
  const diffs: DocTagDiff[] = []
  for (const newTag of newTags) {
    const oldTag = oldTags.find(
      tag =>
        tag.tagName === newTag.tagName &&
        // Match on extname too since there could be multiple files with the same tags
        // e.g a kotlin and java version of the same code snippet
        path.extname(tag.filePath) === path.extname(newTag.filePath)
    )
    if (!oldTag) {
      diffs.push({
        filePath: newTag.filePath,
        tagName: newTag.tagName,
        changeType: 'code_contents',
        type: 'added'
      })
    } else {
      const newDiffs = createDocTagDiff(oldTag, newTag)
      if (newDiffs.length) diffs.push(...newDiffs)
    }
  }

  // Find removed tags
  for (const oldTag of oldTags) {
    const newTag = newTags.find(tag => tag.tagName === oldTag.tagName)
    if (!newTag) {
      diffs.push({
        filePath: oldTag.filePath,
        tagName: oldTag.tagName,
        changeType: 'code_contents',
        type: 'removed'
      })
    }
  }

  return diffs
}

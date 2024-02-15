import * as core from '@actions/core'
import * as github from '@actions/github'

enum DiffScope {
  BOTH = 'both',
  ADDED = 'added',
  REMOVED = 'removed'
}

interface GithubComment {
  body: string
  path: string
  line: number
  side: string
}

const hiddenCommentMarkup =
  '<!-- This is an auto-generated comment: regex-match-commenter-action -->'

function isDuplicateComment(
  existingComments: GithubComment[],
  path: string,
  line: number,
  side: 'LEFT' | 'RIGHT'
): boolean {
  return existingComments.some(
    comment =>
      comment.body.includes(hiddenCommentMarkup) &&
      comment.path === path &&
      comment.line === line &&
      comment.side === side
  )
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const token: string = core.getInput('github_token', { required: true })
    const regexPattern: string = core.getInput('regex_pattern', {
      required: true
    })
    const diffScope: DiffScope = (core.getInput('diff_scope') ||
      'both') as DiffScope
    const markChangesRequested: boolean =
      core.getInput('mark_changes_requested') === 'true'
    const matchFoundMessage: string = core.getInput('match_found_message')
    const noMatchFoundMessage: string = core.getInput('no_match_found_message')
    const changesRequestedMessage: string = core.getInput(
      'changes_requested_message'
    )

    const octokit = github.getOctokit(token)
    const { context } = github

    core.info('Fetching pull request ...')
    if (context.payload.pull_request == null) {
      core.setFailed('No pull request found.')
      return
    }

    const pullRequestNumber = context.payload.pull_request.number
    const owner = context.repo.owner
    const repo = context.repo.repo

    // Fetch PR diff
    core.info('Fetching pull request diff ...')
    const { data: diffData } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullRequestNumber,
      mediaType: {
        format: 'diff'
      }
    })

    // Fetch existing comments on the PR
    core.info('Fetching existing comments ...')
    const existingComments = await octokit.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number: pullRequestNumber
    })
    core.debug(JSON.stringify(existingComments, null, 2))

    // Parse diff and search for regex matches
    core.info('Parsing diff and searching for matches ...')
    const lines = (diffData as unknown as string).split('\n')
    core.debug(JSON.stringify(lines, null, 2))

    const regex = new RegExp(regexPattern)
    const newComments = []
    let foundMatches = false
    let currentFile = ''
    let oldLineNumber = 0
    let newLineNumber = 0

    for (const line of lines) {
      if (line.startsWith('diff --git a/')) {
        currentFile = line.substring(
          'diff --git a/'.length,
          line.indexOf(' b/')
        )
        continue
      }

      if (line.startsWith('--- a/') || line.startsWith('+++ b/')) {
        // Ignore the file path lines
        continue
      }

      if (line.startsWith('@@')) {
        // Parse and set the starting line numbers from the hunk header
        const match = line.match(/-(\d+),\d+ \+(\d+),\d+/)
        if (match) {
          oldLineNumber = parseInt(match[1], 10) - 1
          newLineNumber = parseInt(match[2], 10) - 1
        }
      } else {
        // Increment the appropriate line number
        if (line.startsWith('-')) {
          oldLineNumber++
        } else if (line.startsWith('+')) {
          newLineNumber++
        } else {
          oldLineNumber++
          newLineNumber++
        }
      }

      if (
        ((diffScope === DiffScope.BOTH || diffScope === DiffScope.ADDED) &&
          line.startsWith('+')) ||
        ((diffScope === DiffScope.BOTH || diffScope === DiffScope.REMOVED) &&
          line.startsWith('-'))
      ) {
        if (regex.test(line)) {
          const side = line.startsWith('+') ? 'RIGHT' : 'LEFT'
          const isDuplicate = isDuplicateComment(
            existingComments.data as GithubComment[],
            currentFile,
            side === 'RIGHT' ? newLineNumber : oldLineNumber,
            side
          )
          foundMatches = true

          core.debug(`Regex matched ...`)
          core.debug(
            JSON.stringify(
              {
                currentFile,
                lineContent: line,
                lineNumber: side === 'RIGHT' ? newLineNumber : oldLineNumber,
                isDuplicate
              },
              null,
              2
            )
          )

          if (!isDuplicate) {
            core.info(`Match found`)
            newComments.push({
              path: currentFile,
              body: `${hiddenCommentMarkup}\n${matchFoundMessage}`,
              line: side === 'RIGHT' ? newLineNumber : oldLineNumber,
              side
            })
          } else {
            core.info(`Match found but already commented`)
          }
        }
      }
    }

    if (!foundMatches) {
      core.info('Adding comment about no matches found ...')
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullRequestNumber,
        body: noMatchFoundMessage
      })
    }

    if (newComments.length > 0) {
      core.info('Adding comments to the pull request ...')
      await octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullRequestNumber,
        event: markChangesRequested ? 'REQUEST_CHANGES' : undefined,
        body: changesRequestedMessage,
        comments: newComments
      })
    }

    // If there are no matches and no new comments, then we don't need to update the PR
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

import * as core from '@actions/core'
import * as github from '@actions/github'

enum DiffScope {
  BOTH = 'both',
  ADDED = 'added',
  REMOVED = 'removed'
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const token: string = core.getInput('github_token', { required: true })
    const regexPatterns: string[] = core
      .getInput('regex_patterns', { required: true })
      .split(',')
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

    core.debug('Fetching pull request ...')
    if (context.payload.pull_request == null) {
      core.setFailed('No pull request found.')
      return
    }

    const pullRequestNumber = context.payload.pull_request.number
    const owner = context.repo.owner
    const repo = context.repo.repo

    // Fetch PR diff
    core.debug('Fetching pull request diff ...')
    const { data: diffData } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullRequestNumber,
      mediaType: {
        format: 'diff'
      }
    })

    // Fetch existing comments on the PR
    core.debug('Fetching existing comments ...')
    const existingComments = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullRequestNumber
    })

    // Parse diff and search for regex matches
    core.debug('Parsing diff and searching for matches ...')
    const lines = (diffData as unknown as string).split('\n')
    let foundMatches = false
    let currentFile = ''
    let currentLineNumber = 0

    for (const line of lines) {
      if (line.startsWith('+++ b/')) {
        currentFile = line.substring('+++ b/'.length)
        currentLineNumber = 0 // Reset line number for each new file
      } else if (line.startsWith('+') || line.startsWith('-')) {
        currentLineNumber++ // Count only added or removed lines
      }

      if (
        ((diffScope === DiffScope.BOTH || diffScope === DiffScope.ADDED) &&
          line.startsWith('+')) ||
        ((diffScope === DiffScope.BOTH || diffScope === DiffScope.REMOVED) &&
          line.startsWith('-'))
      ) {
        for (const pattern of regexPatterns) {
          const regex = new RegExp(pattern)
          if (regex.test(line)) {
            // Before posting a new comment, check if it already exists
            const isDuplicate = existingComments.data.some(
              comment => comment.body === matchFoundMessage
            )

            if (!isDuplicate) {
              core.debug(`Match found`)
              foundMatches = true
              const side = line.startsWith('+') ? 'RIGHT' : 'LEFT'
              await octokit.rest.pulls.createReviewComment({
                owner,
                repo,
                pull_number: pullRequestNumber,
                body: matchFoundMessage,
                commit_id: context.payload.pull_request.head.sha,
                path: currentFile,
                side,
                line: currentLineNumber
              })
            } else {
              core.debug(`Match found but already commented`)
            }
          }
        }
      }
    }

    if (!foundMatches) {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullRequestNumber,
        body: noMatchFoundMessage
      })
    }

    // Optional: Mark PR as changes requested
    if (markChangesRequested && foundMatches) {
      await octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullRequestNumber,
        event: 'REQUEST_CHANGES',
        body: changesRequestedMessage
      })
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

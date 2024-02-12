# Regular Expression Match Commenter Action

[![GitHub Super-Linter](https://github.com/zumba/regex-match-commenter-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/zumba/regex-match-commenter-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/zumba/regex-match-commenter-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/zumba/regex-match-commenter-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/zumba/regex-match-commenter-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/zumba/regex-match-commenter-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This GitHub Action searches for specified regular expression pattern in the
changes of a pull request. If matches are found, it can optionally mark the
pull request for changes and add inline comments. If no matches are found,
a comment is added to the pull request.

Some use cases are for detecting PII changes on the code. For example, you can
monitor if the words `email`, `phone`, `street`, `password`, etc. are part of
the changes.
The match uses regular expression, so you can also look for variables such as
`\w+@\w+.\w+` to look for an actual email address.

## Inputs

### `github_token`

**Required** GitHub token for authentication. Typically, this is the GitHub
Actions token.

### `regex_pattern`

**Required** A regular expression pattern to search for in the pull
request diff.

### `diff_scope`

The scope of the diff to search. Can be `added`, `removed`, or `both`.
Default is `both`.

### `mark_changes_requested`

Boolean indicating whether the pull request should be marked as "request
changes" if regular expression matches are found. Default is `false`.

### `match_found_message`

Custom message for a regular expression match. This message is used for inline
comments on the pull request. Default is `Regex match found.`.

### `no_match_found_message`

Custom message to comment on the pull request when no regular expression
matches are found. Default is `No regex matches found in the diff.`

### `changes_requested_message`

Custom message for marking the pull request as changes requested. Used only if
`mark_changes_requested` is `true`. Default is
`Changes are requested due to regex match.`

## Usage

To use this action, create a workflow file (e.g.,
`.github/workflows/regex-match.yml`) in your repository:

```yaml
name: Regex Match

on: [pull_request]

jobs:
  regex-match:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Regex Match Action
      uses: zumba/regex-match-commenter-action@v1
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        regex_pattern: 'email|phone'
        diff_scope: 'both'
        mark_changes_requested: false
        match_found_message: 'Attention needed.'
        no_match_found_message: 'No issues detected in the diff.'
        changes_requested_message: 'Please address the commented issues.'
```

## Contributing

Contributions to this action are welcome! Please follow the standard GitHub
pull request workflow to submit your changes.

## Development Setup

After you've cloned the repository to your local machine or codespace, you'll
need to perform some initial setup steps before you can develop your action.

1. :hammer_and_wrench: Install the dependencies

   ```bash
   npm install
   ```

1. :building_construction: Package the TypeScript for distribution

   ```bash
   npm run bundle
   ```

1. :white_check_mark: Run the tests

   ```bash
   $ npm test

   PASS  ./index.test.js
   ```

## Publishing a New Release

This project includes a helper script, [`script/release`](./script/release)
designed to streamline the process of tagging and pushing new releases for
GitHub Actions.

GitHub Actions allows users to select a specific version of the action to use,
based on release tags. This script simplifies this process by performing the
following steps:

1. **Retrieving the latest release tag:** The script starts by fetching the most
   recent release tag by looking at the local data available in your repository.
1. **Prompting for a new release tag:** The user is then prompted to enter a new
   release tag. To assist with this, the script displays the latest release tag
   and provides a regular expression to validate the format of the new tag.
1. **Tagging the new release:** Once a valid new tag is entered, the script tags
   the new release.
1. **Pushing the new tag to the remote:** Finally, the script pushes the new tag
   to the remote repository. From here, you will need to create a new release in
   GitHub and users can easily reference the new tag in their workflows.

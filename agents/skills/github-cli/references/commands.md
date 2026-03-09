# gh CLI Command Reference

## Table of Contents

1. [pr](#pr) — Pull request management
2. [issue](#issue) — Issue management
3. [run](#run) — GitHub Actions runs
4. [workflow](#workflow) — GitHub Actions workflows
5. [release](#release) — Release management
6. [repo](#repo) — Repository operations
7. [api](#api) — Raw API access
8. [search](#search) — Search across GitHub
9. [label](#label) — Label management
10. [project](#project) — GitHub Projects (v2)

---

## pr

### `gh pr create`

| Flag                   | Description                           |
| ---------------------- | ------------------------------------- |
| `--title`              | PR title                              |
| `--body`               | PR body (supports markdown)           |
| `--base`               | Target branch (default: repo default) |
| `--head`               | Source branch (default: current)      |
| `--fill`               | Auto-fill title/body from commits     |
| `--draft`              | Create as draft                       |
| `--reviewer`           | Request reviewers (comma-separated)   |
| `--assignee`           | Assign users                          |
| `--label`              | Add labels                            |
| `--milestone`          | Set milestone                         |
| `--project`            | Add to project                        |
| `--web`                | Open browser to create                |
| `--no-maintainer-edit` | Disable maintainer edits              |
| `--template`           | Use issue template file               |
| `--body-file`          | Read body from file                   |

### `gh pr list`

| Flag         | Description                       |
| ------------ | --------------------------------- |
| `--state`    | Filter: open, closed, merged, all |
| `--label`    | Filter by label                   |
| `--assignee` | Filter by assignee                |
| `--author`   | Filter by author                  |
| `--base`     | Filter by base branch             |
| `--head`     | Filter by head branch             |
| `--search`   | Search query                      |
| `--limit`    | Max results (default: 30)         |
| `--json`     | Output fields as JSON             |
| `--jq`       | JQ expression for JSON            |

### `gh pr view <number>`

| Flag         | Description           |
| ------------ | --------------------- |
| `--json`     | Output fields as JSON |
| `--jq`       | JQ expression         |
| `--web`      | Open in browser       |
| `--comments` | Show comments         |

**JSON fields:** `number`, `title`, `body`, `state`, `author`, `url`, `headRefName`, `baseRefName`, `reviews`, `statusCheckRollup`, `labels`, `assignees`, `milestone`, `files`, `additions`, `deletions`, `changedFiles`, `createdAt`, `updatedAt`, `mergedAt`, `closedAt`, `isDraft`, `mergeable`, `mergeStateStatus`

### `gh pr merge <number>`

| Flag              | Description               |
| ----------------- | ------------------------- |
| `--merge`         | Merge commit              |
| `--squash`        | Squash and merge          |
| `--rebase`        | Rebase and merge          |
| `--auto`          | Enable auto-merge         |
| `--delete-branch` | Delete branch after merge |
| `--subject`       | Custom commit subject     |
| `--body`          | Custom commit body        |
| `--admin`         | Use admin privileges      |

### `gh pr review <number>`

| Flag                | Description     |
| ------------------- | --------------- |
| `--approve`         | Approve         |
| `--request-changes` | Request changes |
| `--comment`         | Leave a comment |
| `--body`            | Review body     |

### Other pr subcommands

| Command                   | Description                 |
| ------------------------- | --------------------------- |
| `gh pr checkout <number>` | Check out PR branch locally |
| `gh pr close <number>`    | Close PR                    |
| `gh pr reopen <number>`   | Reopen PR                   |
| `gh pr ready <number>`    | Mark as ready for review    |
| `gh pr diff <number>`     | View PR diff                |
| `gh pr edit <number>`     | Edit PR fields              |
| `gh pr checks <number>`   | View CI check status        |
| `gh pr comment <number>`  | Add comment                 |
| `gh pr lock <number>`     | Lock conversation           |
| `gh pr unlock <number>`   | Unlock conversation         |

---

## issue

### `gh issue create`

| Flag          | Description         |
| ------------- | ------------------- |
| `--title`     | Issue title         |
| `--body`      | Issue body          |
| `--label`     | Add labels          |
| `--assignee`  | Assign users        |
| `--milestone` | Set milestone       |
| `--project`   | Add to project      |
| `--template`  | Use template        |
| `--body-file` | Read body from file |
| `--web`       | Open browser        |

### `gh issue list`

| Flag          | Description         |
| ------------- | ------------------- |
| `--state`     | open, closed, all   |
| `--label`     | Filter by label     |
| `--assignee`  | Filter by assignee  |
| `--author`    | Filter by author    |
| `--mention`   | Filter by mention   |
| `--milestone` | Filter by milestone |
| `--search`    | Search query        |
| `--limit`     | Max results         |
| `--json`      | JSON output         |
| `--jq`        | JQ expression       |

### `gh issue view <number>`

| Flag         | Description     |
| ------------ | --------------- |
| `--json`     | JSON output     |
| `--jq`       | JQ expression   |
| `--web`      | Open in browser |
| `--comments` | Show comments   |

### Other issue subcommands

| Command                             | Description                                                     |
| ----------------------------------- | --------------------------------------------------------------- |
| `gh issue close <number>`           | Close issue (--reason: completed, not_planned)                  |
| `gh issue reopen <number>`          | Reopen issue                                                    |
| `gh issue edit <number>`            | Edit fields (--add-label, --remove-label, --add-assignee, etc.) |
| `gh issue comment <number>`         | Add comment                                                     |
| `gh issue pin <number>`             | Pin issue                                                       |
| `gh issue unpin <number>`           | Unpin issue                                                     |
| `gh issue lock <number>`            | Lock conversation                                               |
| `gh issue transfer <number> <repo>` | Transfer to another repo                                        |
| `gh issue develop <number>`         | Create branch for issue                                         |

---

## run

### `gh run list`

| Flag         | Description                                  |
| ------------ | -------------------------------------------- |
| `--workflow` | Filter by workflow file                      |
| `--branch`   | Filter by branch                             |
| `--event`    | Filter by trigger event                      |
| `--status`   | Filter: queued, in_progress, completed, etc. |
| `--user`     | Filter by user                               |
| `--limit`    | Max results                                  |
| `--json`     | JSON output                                  |

### `gh run view <run-id>`

| Flag            | Description                |
| --------------- | -------------------------- |
| `--log`         | Full logs                  |
| `--log-failed`  | Logs for failed steps only |
| `--exit-status` | Exit with run status code  |
| `--job`         | View specific job          |
| `--web`         | Open in browser            |

### Other run subcommands

| Command                    | Description                            |
| -------------------------- | -------------------------------------- |
| `gh run watch <run-id>`    | Watch run until complete               |
| `gh run rerun <run-id>`    | Re-run (--failed for failed jobs only) |
| `gh run cancel <run-id>`   | Cancel run                             |
| `gh run download <run-id>` | Download artifacts                     |
| `gh run delete <run-id>`   | Delete run                             |

---

## workflow

| Command                      | Description                                              |
| ---------------------------- | -------------------------------------------------------- |
| `gh workflow list`           | List workflows                                           |
| `gh workflow view <name>`    | View workflow details                                    |
| `gh workflow run <name>`     | Trigger workflow (--ref branch, -f key=value for inputs) |
| `gh workflow enable <name>`  | Enable workflow                                          |
| `gh workflow disable <name>` | Disable workflow                                         |

---

## release

### `gh release create <tag>`

| Flag                    | Description                    |
| ----------------------- | ------------------------------ |
| `--title`               | Release title                  |
| `--notes`               | Release notes                  |
| `--notes-file`          | Read notes from file           |
| `--generate-notes`      | Auto-generate from commits     |
| `--draft`               | Create as draft                |
| `--prerelease`          | Mark as prerelease             |
| `--target`              | Target branch/commit           |
| `--latest`              | Mark as latest (default: true) |
| `--discussion-category` | Create discussion              |

### Other release subcommands

| Command                           | Description     |
| --------------------------------- | --------------- |
| `gh release list`                 | List releases   |
| `gh release view <tag>`           | View release    |
| `gh release edit <tag>`           | Edit release    |
| `gh release delete <tag>`         | Delete release  |
| `gh release upload <tag> <files>` | Upload assets   |
| `gh release download <tag>`       | Download assets |

---

## repo

| Command                     | Description                          |
| --------------------------- | ------------------------------------ |
| `gh repo view`              | View current repo                    |
| `gh repo clone <repo>`      | Clone repo                           |
| `gh repo fork <repo>`       | Fork repo (--clone to clone locally) |
| `gh repo create <name>`     | Create repo                          |
| `gh repo delete <repo>`     | Delete repo (--yes to confirm)       |
| `gh repo edit`              | Edit repo settings                   |
| `gh repo rename <new-name>` | Rename repo                          |
| `gh repo archive <repo>`    | Archive repo                         |
| `gh repo sync`              | Sync fork with upstream              |
| `gh repo set-default`       | Set default repo for commands        |

---

## api

```bash
# GET (default)
gh api <endpoint>

# Other methods
gh api <endpoint> -X POST
gh api <endpoint> -X PATCH
gh api <endpoint> -X DELETE

# With data
gh api <endpoint> -f key=value        # string field
gh api <endpoint> -F key=value        # typed field (infers int/bool)
gh api <endpoint> --input file.json   # JSON from file

# Pagination
gh api <endpoint> --paginate

# GraphQL
gh api graphql -f query='...'
gh api graphql -f query='...' -F var=value

# Output
gh api <endpoint> --jq '.field'
gh api <endpoint> --template '{{.field}}'

# Headers
gh api <endpoint> -H "Accept: application/vnd.github+json"
```

### Common API endpoints

| Endpoint                                        | Description        |
| ----------------------------------------------- | ------------------ |
| `repos/{owner}/{repo}`                          | Repo details       |
| `repos/{owner}/{repo}/pulls`                    | List PRs           |
| `repos/{owner}/{repo}/pulls/{number}/comments`  | PR review comments |
| `repos/{owner}/{repo}/pulls/{number}/reviews`   | PR reviews         |
| `repos/{owner}/{repo}/issues`                   | List issues        |
| `repos/{owner}/{repo}/issues/{number}/comments` | Issue comments     |
| `repos/{owner}/{repo}/actions/runs`             | Workflow runs      |
| `repos/{owner}/{repo}/actions/workflows`        | Workflows          |
| `repos/{owner}/{repo}/releases`                 | Releases           |
| `repos/{owner}/{repo}/labels`                   | Labels             |
| `repos/{owner}/{repo}/milestones`               | Milestones         |
| `repos/{owner}/{repo}/collaborators`            | Collaborators      |
| `repos/{owner}/{repo}/branches`                 | Branches           |
| `repos/{owner}/{repo}/commits`                  | Commits            |
| `repos/{owner}/{repo}/compare/{base}...{head}`  | Compare branches   |

---

## search

| Command                     | Description         |
| --------------------------- | ------------------- |
| `gh search repos <query>`   | Search repositories |
| `gh search issues <query>`  | Search issues       |
| `gh search prs <query>`     | Search PRs          |
| `gh search commits <query>` | Search commits      |
| `gh search code <query>`    | Search code         |

Common flags: `--owner`, `--repo`, `--language`, `--limit`, `--json`, `--jq`, `--web`

---

## label

| Command                  | Description                           |
| ------------------------ | ------------------------------------- |
| `gh label list`          | List labels                           |
| `gh label create <name>` | Create label (--color, --description) |
| `gh label edit <name>`   | Edit label                            |
| `gh label delete <name>` | Delete label                          |
| `gh label clone <repo>`  | Clone labels from another repo        |

---

## project

| Command                          | Description         |
| -------------------------------- | ------------------- |
| `gh project list`                | List projects       |
| `gh project view <number>`       | View project        |
| `gh project create`              | Create project      |
| `gh project item-list <number>`  | List project items  |
| `gh project item-add <number>`   | Add item to project |
| `gh project field-list <number>` | List fields         |

---

## Global Flags

Available on most commands:

| Flag                  | Description             |
| --------------------- | ----------------------- |
| `--repo owner/repo`   | Target specific repo    |
| `--json <fields>`     | Output as JSON          |
| `--jq <expression>`   | Filter JSON output      |
| `--template <string>` | Format with Go template |
| `--web`               | Open in browser         |
| `--help`              | Show help               |

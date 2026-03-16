---
name: follow-up-ticket-hardening
description: Convert PR review findings into developer-ready follow-up tickets while preserving original reviewer prompts verbatim and structuring actionable acceptance criteria.
---

# Follow-up Ticket Hardening

Use this skill when a user asks to improve an issue using PR review comments, especially for i18n/accessibility/regression hardening follow-ups.

## Goal

Create high-signal follow-up tickets that:
- preserve reviewer intent exactly,
- reduce ambiguity for implementers,
- and keep traceability from issue -> review thread -> implementation PRs.

## Required Behavior

1. Keep original prompts unchanged when requested:
   - Do not paraphrase, reorder, or "clean up" wording.
   - Paste prompt text in fenced `text` blocks.
2. Add only minimal structure around prompts:
   - section title (file/path),
   - optional severity label,
   - optional execution checklist.
3. Preserve source links:
   - parent issue,
   - PR review URL,
   - any related epic link.

## Standard Workflow

### 1) Intake

- Confirm target issue number and repository.
- Confirm source review URL.
- Identify whether user wants:
  - **verbatim mode** (no prompt edits), or
  - **developer-friendly mode** (summaries + original prompt block).

### 2) Extract findings

- Capture requested comment groups (for example: "Outside diff range comments (8)").
- Keep each finding grouped by file.
- If one file has multiple findings, split into separate sections.

### 3) Build ticket body

Use this structure:

1. `## Parent epic` (if available)
2. `## Source` (review URL)
3. `## Findings` or `## Work packages`
4. Per-finding sections:
   - file path heading
   - `Original reviewer prompt` block (verbatim if requested)
5. `## Acceptance criteria`

### 4) Update issue

- Use `gh issue edit <id> --repo <owner/repo> --body "$(cat <<'EOF' ... EOF)"`.
- Re-open and verify with `gh issue view --json body,url`.

## Acceptance Criteria Template

- Functional identifiers remain locale-agnostic where applicable.
- User-visible copy is localized across supported locales.
- Accessibility labels/attributes are localized.
- Security/link hardening rules are met (`noopener noreferrer` for external `_blank`).
- Regression coverage is defined (tests or QA matrix).
- Follow-up PRs are linked back to the issue.

## Quality Checks

Before finalizing:
1. Every requested finding appears exactly once.
2. No prompt text was altered in verbatim mode.
3. File paths in headings match prompt content.
4. Source review URL is present.
5. Ticket remains scannable for developers.

## Failure Handling

- If GitHub auth fails: run `gh auth status` and retry with broader permissions.
- If issue edit fails due to quoting: switch to HEREDOC body payload.
- If requested prompts cannot be located: ask user which exact block to mirror before editing.

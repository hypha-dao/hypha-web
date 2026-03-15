---
name: obsidian-requirements
description: Work with the Obsidian requirements vault in docs/requirements/. Use when creating, editing, or reviewing product requirement documents, feature specs, Kanban boards, implementation tickets, or when the user mentions requirements, specs, PRDs, or the docs/requirements directory.
---

# Obsidian Requirements Vault

Manage product and engineering requirements in `docs/requirements/` using feature folders, Kanban boards, and structured tickets designed for AI agent workflows.

## Vault Location & Structure

```
docs/requirements/
  README.md                               # Vault conventions & index
  glossary.md                             # Shared terminology
  Main Board.md                           # Level 1 Kanban: features/epics
  Templates/
    feature-requirements.md               # Template for new requirement specs
    implementation-ticket.md              # Template for new tickets
  Features/
    {feature-name}/                       # One folder per feature
      requirements.md                     # The requirement specification
      board.md                            # Level 2 Kanban: implementation tickets
      tickets/
        {ticket-slug}.md                  # Individual implementation tickets
```

## Kanban Board Format

Boards use the [mgmeyers/obsidian-kanban](https://github.com/mgmeyers/obsidian-kanban) plugin format: a single markdown file with `kanban-plugin: basic` frontmatter, `## Heading` columns, and `- [ ] [[wikilink]]` cards.

### Main Board (`Main Board.md`)

Tracks features/epics through the requirements lifecycle.

**Columns (in order):** `Backlog` → `In Refinement` → `Ready for Implementation` → `In Progress` → `Done`

Cards are wikilinks to feature requirement docs:

```markdown
- [ ] [[Features/feature-name/requirements|Feature Display Name]] #feature
```

### Feature Board (`Features/{feature}/board.md`)

Tracks implementation tickets for a single feature.

**Columns (in order):** `Todo` → `In Progress` → `In Review` → `Done`

Cards are wikilinks to ticket files:

```markdown
- [ ] [[tickets/ticket-slug|FR-N: Ticket Title]]
```

### Board Update Protocol

To move a card between columns:

1. Read the board file
2. Remove the `- [ ] [[...]]` line from the source column
3. Add it under the target `## Column` heading
4. Write the updated file

To mark a card complete, change `- [ ]` to `- [x]`.

## Creating a New Feature

1. Create directory `docs/requirements/Features/{feature-name}/` with a `tickets/` subdirectory
2. Copy `Templates/feature-requirements.md` to `Features/{feature-name}/requirements.md` and fill it in
3. Create `Features/{feature-name}/board.md` using kanban format with tickets in `Todo`
4. Add a card to `Main Board.md` under the appropriate column

## Creating a New Ticket

1. Copy `Templates/implementation-ticket.md` to `Features/{feature-name}/tickets/{ticket-slug}.md`
2. Fill in frontmatter: `id`, `title`, `type`, `priority`, `parent-feature`, `status`
3. Write the requirement statement using SHALL/MUST language
4. Add testable acceptance criteria as checkboxes
5. Add a card to `Features/{feature-name}/board.md` in the `Todo` column

## Requirement Spec Template

Use `Templates/feature-requirements.md`. Required sections:

1. **Document Control** — owner, status, date
2. **Background and Intent** — why this feature exists
3. **Goals** — what success looks like
4. **Non-goals** — explicit exclusions
5. **Personas** — who uses this and how
6. **Functional Requirements** — `FR-*` prefixed, SHALL/MUST language
7. **Non-functional Requirements** — `NFR-*` prefixed, quantitative where possible
8. **Acceptance Criteria** — `AC-*` prefixed, testable
9. **Open Questions** — unresolved items as checkboxes
10. **Rollout Plan** — phased delivery approach

## Ticket Template

Use `Templates/implementation-ticket.md`. Required sections:

1. **Frontmatter** — id, title, type, priority, parent-feature, status
2. **Requirement** — the specific requirement statement
3. **Acceptance Criteria** — testable checkboxes
4. **Implementation Notes** — filled by implementation agent
5. **Source** — wikilink back to requirement doc + section reference

## Requirement ID Prefixes

| Prefix  | Meaning                                      |
|---------|----------------------------------------------|
| `FR-*`  | Functional requirement                       |
| `NFR-*` | Non-functional requirement                   |
| `AC-*`  | Acceptance criteria                          |
| `PAR-*` | Parity constraint (matching existing behavior)|

## Agent Workflow

### Requirements Agent

1. Read `Main Board.md` → find items in `Backlog`
2. Move card to `In Refinement`
3. Create or update `Features/{feature}/requirements.md` using the template
4. Decompose functional requirements into tickets in `Features/{feature}/tickets/`
5. Create `Features/{feature}/board.md` with all tickets in `Todo`
6. Move master board card to `Ready for Implementation`

### Implementation Agent

1. Read a feature's `board.md` → find items in `Todo`
2. Move card to `In Progress`
3. Read the linked ticket file for requirement + acceptance criteria
4. Implement the change in the codebase
5. Check off acceptance criteria checkboxes in the ticket
6. Move card to `In Review` (or `Done` if self-verified)

## Writing Style

- Start with a **Current State** section when grounded in prototype/implemented behavior
- Be specific and testable — avoid vague language like "should be fast"
- Use SHALL for mandatory requirements, SHOULD for recommended, MAY for optional
- Reference source branches or prototypes when documenting parity constraints
- Cross-reference related docs with relative wikilinks: `[[../feature-name/requirements]]` within `Features/`

## Reviewing Requirements

1. Read `Main Board.md` first for an overview of all features and their state
2. Check for missing sections (Goals, Non-goals, Acceptance Criteria)
3. Verify requirement IDs are unique and sequential within each document
4. Flag vague or untestable requirements
5. Verify each FR has at least one corresponding ticket with acceptance criteria
6. Confirm board state matches ticket frontmatter status

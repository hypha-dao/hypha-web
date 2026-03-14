# Requirements Vault

Product and engineering requirements for Hypha, managed as an Obsidian vault with Kanban-driven workflows for AI agents.

## How It Works

This vault uses a two-level Kanban system:

1. **[[Main board]]** (`Main Board.md`) tracks features/epics through the requirements lifecycle
2. **Feature boards** (`Features/{feature}/board.md`) track implementation tickets within each feature

Boards use the [obsidian-kanban](https://github.com/mgmeyers/obsidian-kanban) plugin format and are readable/writable by both humans in Obsidian and AI agents via markdown editing.

## Vault Structure

```
Main Board.md                           ← feature/epic Kanban
glossary.md                             ← shared terminology
Templates/
  feature-requirements.md               ← template for new requirement specs
  implementation-ticket.md              ← template for new tickets
Features/
  {feature-name}/
    requirements.md                     ← the requirement specification
    board.md                            ← implementation ticket Kanban
    tickets/
      {ticket-slug}.md                  ← individual tickets
```

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| [chat-signals-parity](Features/chat-signals-parity/requirements.md) | Ready for Implementation | Feature-parity contract based on the early chat-signals prototype |
| [ai-left-panel-space-context](Features/ai-left-panel-space-context/requirements.md) | In Refinement | AI left panel with space-aware context, multimodal inputs, and signal generation |

## Workflow

### Requirements Agent

1. Picks a backlog item from `Main Board.md`
2. Writes the requirement spec in `Features/{feature}/requirements.md`
3. Decomposes into tickets in `Features/{feature}/tickets/`
4. Creates the feature board and moves the master card to `Ready for Implementation`

### Implementation Agent

1. Picks a `Todo` ticket from a feature's `Features/{feature}/board.md`
2. Reads the ticket for requirements and acceptance criteria
3. Implements and checks off acceptance criteria
4. Moves the ticket card to `In Review` or `Done`

## Conventions

- **Requirement IDs**: `FR-*` (functional), `NFR-*` (non-functional), `AC-*` (acceptance criteria), `PAR-*` (parity constraints)
- **Requirement language**: SHALL (mandatory), SHOULD (recommended), MAY (optional)
- **File naming**: kebab-case for all files and folders
- **Cross-references**: use relative wikilinks `[[../feature-name/requirements]]` within `Features/`
- See `glossary.md` for shared terminology

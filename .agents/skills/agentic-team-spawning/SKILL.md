---
name: agentic-team-spawning
description: Use when the user wants to spawn/assemble experts, route a multi-domain task, or orchestrate a minimal team from .agents/roles (including "max N agents" prompts); skip narrow single-expert work. Then map intent to roles and spawn only the sub-agents needed for execution.
---

# Agentic Team Spawning

Assemble a task-specific engineering team from `.agents/roles` and avoid spawning unnecessary experts.

## When to Use

Use this skill when:
- The user asks to "spawn a team", "assemble experts", or "route this task to agents".
- The request spans multiple specialties (product, requirements, UI, backend, DB, QA, security, i18n, prompt design).
- You need to decide which experts are required before implementation.

Do not use this skill for narrow single-domain tasks where one expert is enough.

## Primary Objective

1. Infer the real task from the user prompt.
2. Select the smallest expert set that can complete the task safely.
3. Spawn only those experts as sub-agents.
4. Synthesize outputs into one coherent execution plan/result.

## Inputs

- User prompt
- Repository context
- Role mapping: `references/role-intent-map.md`
- Team recipes: `references/team-composition-recipes.md`

## Routing Workflow

### 1) Extract Intent Signals

Parse the prompt for:
- **Task type**: build, debug, review, design, plan, secure, test, translate
- **Target surface**: UI, API, DB, infra, docs, prompts, workflows
- **Risk level**: security-sensitive, migration, production-facing
- **Ambiguity**: missing requirements or acceptance criteria

### 2) Pick Orchestration Mode

- **Solo expert**: one domain clearly dominates.
- **Dual/Trio team**: cross-functional but bounded.
- **Triage-first**: ambiguous prompt; start with requirements/prompt/meta-cognitive expert, then spawn implementation experts.

Default to the smallest mode that can succeed.

### 3) Select Roles from the Map

Use `references/role-intent-map.md` to map signals to roles.

Selection rules:
- Every chosen role must have a direct responsibility tied to the prompt.
- Remove any role without concrete deliverables.
- Prefer one fullstack role over multiple overlapping implementation roles when sufficient.
- Add QA and security only when risk/impact justifies them.

### 4) Spawn Sub-Agents Minimally

- Spawn at most 4 sub-agents concurrently (hard cap per wave).
- If `max_agents` is provided, concurrent execution is `min(max_agents, 4)`.
- If more are needed, run in waves while respecting the per-wave cap.
- Give each agent a focused, non-overlapping scope.
- Request strict structured output from each sub-agent:
  - Assumptions
  - Proposed changes
  - Tests/validation
  - Risks/edge cases
  - Handoff notes

### 5) Sub-Agent Prompt Template

Use this template for each selected role:

`Role:` <exact role name from role map>  
`Task slice:` <specific ownership, no overlap>  
`Context:` <relevant files/scope only>  
`Return format:` assumptions, plan, concrete changes, tests, risks, handoff  
`Constraints:` no scope creep; stay inside assigned slice

### 6) Synthesize and Resolve Conflicts

- Merge outputs into one plan ordered by dependencies.
- Resolve contradictions (architecture, requirements, test strategy).
- If unresolved reasoning conflict remains, route to Meta-Cognitive Reasoning Expert for arbitration.

### 7) Execute and Validate

- Implement or delegate implementation from the merged plan.
- Verify with targeted tests tied to changed areas.
- Report only evidence-backed outcomes.

## User Prompt Contract

Support user prompts in this shape:

- `Spawn an agentic team for: <task>`
- `Route this task to the minimum experts: <task>`
- `Team-orchestrate this request with max <N> agents: <task>`

Optional user controls:
- `required_roles: [...]`
- `exclude_roles: [...]`
- `max_agents: <number>` (concurrent sub-agent cap per wave; effective ceiling is `min(max_agents, 4)`)
- `focus: speed | quality | security`

## Response Format (for the orchestrator)

1. **Task Understanding** (1-3 bullets)
2. **Chosen Team** (role, why needed, deliverable)
3. **Spawn Plan** (waves and ownership boundaries)
4. **Execution Summary** (what changed / decided)
5. **Validation** (tests or checks run)

## Guardrails

- Never spawn "all experts" by default.
- Never assign the same responsibility to multiple agents.
- Never proceed with high-ambiguity implementation without requirement clarification or triage-first mode.
- Prefer direct execution without sub-agents if the task is simple and low risk.

## References

- `references/role-intent-map.md`
- `references/team-composition-recipes.md`

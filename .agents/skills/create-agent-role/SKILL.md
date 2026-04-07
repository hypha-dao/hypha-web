---
name: create-agent-role
description: Generate a new modular agent role in .agents/roles/ with references/ component reuse and documentation-first behavior. Use when creating new roles like "create a senior clerk engineer" or "create a senior neon db engineer", or migrating an existing prompt to the modular role architecture.
---

# Create Agent Role

Generate new modular agent roles in `.agents/roles/`, maximizing reuse of `references/` components and enforcing documentation-first behavior.

## When to Use

- Creating a new engineer/specialist role (e.g., "senior clerk engineer")
- Creating a new coach/consultant/business role
- Any role that should check official documentation before answering
- Migrating an existing prompt to the modular role architecture

## Workflow

### 1. Parse User Request

Extract from the user's request:

| Parameter | Example | Notes |
|-----------|---------|-------|
| **Role Name** | "senior clerk engineer" | Convert to kebab-case: `senior-clerk-engineer` |
| **Domain** | Clerk authentication | The technology/area of expertise |
| **Docs URL** | `https://clerk.com/docs` | Official documentation link |
| **Seniority** | "senior" | Default: "senior" |

### 2. Scan References for Existing Components

Search `.agents/references/` for reusable components:

```bash
ls .agents/references/competencies/
ls .agents/references/frameworks/
ls .agents/references/methodologies/
ls .agents/references/best-practices/
ls .agents/references/deliverables/
ls .agents/references/collaboration/
ls .agents/references/engagement-models/
ls .agents/references/output-standards/
```

Match components by domain keywords. See `references/existing-components.md` for a catalog of available components and guidance on when to reuse vs. create new ones.

### 3. Handle Missing Components

If a domain-specific component doesn't exist:

1. **Decide**: Is this reusable across 2+ potential roles?
2. **If yes**: Create new component in the appropriate `references/` subcategory
3. **If no**: Keep domain-specific content inline in the role file

### 4. Assemble the Role File

Create: `.agents/roles/{role-name}.base.md`

Use the template in `references/role-template.md`. All roles link to `references/` components via relative paths (`../references/competencies/{file}.md`).

Key sections:
- **System message** with identity, expertise, and documentation requirement
- **Core Competencies** linking to `references/competencies/`
- **Frameworks & Methodologies** linking to `references/frameworks/` and `references/methodologies/`
- **Domain Specialization** with inline technology-specific content
- **Documentation-First Protocol** (required for all tech roles)
- **Response Protocol** with step-by-step approach

### 5. Update AGENTS.md

Add the new role to the router table in `.agents/AGENTS.md`:

```markdown
| **{Role Title}** | [roles/{role-name}.base.md](roles/{role-name}.base.md) | {Comma-separated trigger keywords} |
```

### 6. Validate

Before completing, verify:

- [ ] All `../references/` links resolve to existing files
- [ ] Documentation URL is valid (if applicable)
- [ ] Documentation-first protocol is present for tech roles
- [ ] Role follows naming convention: `{seniority}-{domain}.base.md`
- [ ] Role is registered in `AGENTS.md`
- [ ] Structure is consistent with existing roles in `.agents/roles/`

### 7. Summary

Report what was created:

```
## Role Created: {role-name}

**File:** `.agents/roles/{role-name}.base.md`
**Documentation:** {DOCS_URL} (checked before answering)
**Components:** {N} existing references linked, {M} new references created
```

## References

- `references/role-template.md` — Full role file template with all sections
- `references/existing-components.md` — Catalog of available references/ components

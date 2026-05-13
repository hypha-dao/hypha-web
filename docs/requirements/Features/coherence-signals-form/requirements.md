# Coherence signals — create/edit form alignment

**Status:** Draft  
**Primary UI surface:** Coherence tab signal create and edit overlays

---

## 1. Scope and intent

Align the Signals authoring experience in Coherence so create and edit use the same form structure, updated taxonomies, and a modern tag input model (typeahead suggestions + create new tags).

---

## 2. Field order and taxonomy (normative)

The form SHALL render fields in this order:

1. **Title**
2. **Type**
   - Opportunity = "we could lean into this."
   - Risk = "we could be hurt by this."
   - Tension = "something isn’t aligned."
   - Insight = "shifts how we see things."
3. **Priority**
   - Critical / High / Medium / Low
4. **Description**
5. **Tags**

---

## 3. Functional requirements

**FR-1** The system SHALL use one shared form contract for both **Create Signal** and **Edit Signal**.

**FR-2** The system SHALL support only the following active signal types for create/edit: `Opportunity`, `Risk`, `Tension`, `Insight`.

**FR-3** The system SHALL include priority values: `critical`, `high`, `medium`, `low`.

**FR-4** The system SHALL support a tag input that:

- shows suggestions while typing,
- filters suggestions by typed prefix/text,
- allows selecting one or more suggested tags,
- allows creating and persisting custom tags not in the suggestion catalog.

**FR-5** The system SHALL persist tags as plain strings and SHALL not reject valid custom tags solely because they are outside the suggestion catalog.

**FR-6** The system SHALL allow the signal creator to edit at minimum title, type, priority, description, and tags using the same form surface as create.

**FR-7** The system SHALL allow the signal creator to delete the signal from the edit surface.

**FR-8** The system SHALL deny edit/delete for non-creators.

---

## 4. Tag suggestion catalog (initial)

`Purpose`, `North Star`, `Vision`, `Strategy`, `Values`, `Principles`, `Milestones`, `Impact Goals`, `Trend`, `Social Conditions`, `Planetary Boundaries`, `Policy`, `Regulation`, `Emergency Response`, `Project`, `Quest`, `Job`, `Skill`, `Advisory Support`, `Volunteering`, `Serving Audience`, `Customers`, `Users`, `Communities`, `Beneficiaries`, `Partners`, `Governance`, `Processes`, `Structure`, `Rhythms`, `Support Systems`, `Needs`, `Resources`, `Fundraising`, `Matchmaking`, `Innovation`, `Products`, `Services`, `Product-Market Fit`, `Business Model`, `Data`, `Knowledge`, `Intellectual Property`, `Proof of Action`, `Proof of Impact`, `Learning`, `Feedback Loop`.

---

## 5. DB and contract impact

### 5.1 Database impact

- **No DB schema change required for tags.**
  - Current storage (`coherences.tags` as JSONB string array) already supports suggested + custom tags.
- **No DB schema change required for this feature set.**
  - Type and priority are already text-backed domain values.
- **No DB schema change required for priority critical.**
  - `priority` is already text-backed; this is a domain/validation expansion.

### 5.2 Non-DB changes required for tags (not UI-only)

To support creatable tags, implementation SHALL update:

- **UI behavior:** replace static dropdown semantics with combobox/typeahead + create flow.
- **Validation contract:** stop enforcing tags as enum-only values; accept normalized non-empty strings.
- **Type contract:** tags must be modeled as general strings (or known-tag union plus string fallback), not fixed enum-only.
- **Mutation/API boundary:** create and update signal payloads must accept custom tags and persist without catalog membership checks.

---

## 6. Acceptance criteria

**AC-1** Given user opens Create Signal, when form loads, then fields appear in the required order with new Type and Priority values.

**AC-2** Given user types in Tags, when matching catalog tags exist, then suggestions are shown and selectable by keyboard/mouse.

**AC-3** Given user enters a tag not in catalog, when submitting, then submission succeeds and tag is persisted.

**AC-4** Given creator opens Edit Signal, when they change text, priority, or tags and save, then updated values are persisted.

**AC-5** Given non-creator attempts edit/delete, when action is submitted, then system rejects with authorization error.

**AC-6** Given creator opens Edit Signal and confirms delete, when action completes, then the signal is removed from persistence, no longer appears in the list UI, and subsequent fetch by slug returns not found.

---

## 7. Revision history

| Version | Date       | Author                           | Changes                                                                             |
| ------- | ---------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| 1.0     | 2026-05-07 | Requirements + Fullstack (agent) | Initial spec for coherence signal create/edit alignment and tag model clarification |
| 1.1     | 2026-05-07 | Requirements + Fullstack (agent) | Removed strength from scope; updated feature to no-DB-migration plan                |

# Energy UI rollout

This document tracks the phased delivery and acceptance checks for the Hypha
Energy Community UX.

## Phase 1 - Activation, read models, settlement UX

### Scope
- Persist activation mapping in `energy_communities` when a space is linked to an
  `EnergyPPAv2Factory` deployment.
- Expose community-level energy API (`/api/v1/spaces/[spaceSlug]/energy`).
- Expose profile-level energy API (`/api/v1/people/[personSlug]/energy`).
- Render energy overview + source mix on community treasury.
- Render user energy balances + settlement actions (`settleOwnDebt`,
  `claimCredit`) on profile.

### Acceptance criteria
- A non-energy space returns `enabled: false` from both energy APIs.
- An energy-enabled space returns activation metadata and on-chain snapshot data.
- Profile energy section appears only for users with at least one mapped energy
  community.
- Settlement buttons execute contract writes and refresh balances on success.

## Phase 2 - Energy proposals

### Scope
- Add proposal entry points in the create-action modal:
  - Energy Sharing
  - Register Energy Source
  - Add Energy Member
- Add create routes for those proposal labels.
- Add proposal label mapping for governance badges and resubmit routing.

### Acceptance criteria
- New energy proposal actions are visible in the create-action menu.
- Creating each proposal opens a valid proposal form with expected label.
- Proposal cards show a human-readable badge for each new label.

## Phase 3 - Advanced analytics

### Scope
- Add indexed event pipelines for consumption/production timelines by source and
  by member.
- Add chart widgets to community and profile pages backed by indexed/aggregated
  data.
- Add historical settlement analytics.

### Acceptance criteria
- Community page can filter source-mix charts by period.
- Profile page shows user production/consumption history with period controls.
- API response times stay within existing dashboard latency targets.

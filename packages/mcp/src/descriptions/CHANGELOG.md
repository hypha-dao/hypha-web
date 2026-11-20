# Model-facing text changelog

Every change to `index.ts` in this folder needs a `DESCRIPTIONS_VERSION` bump, a snapshot
update and a line here (K31).

## 1.1.0

- Added `hypha_get_space`, `hypha_list_proposals` and `hypha_get_my_vote`; tool order is now list spaces, get space, list proposals, get my membership, get my vote.
- `hypha_list_proposals` items carry an additive `label`; the description explains that a `Quest` label marks an agreement that proposes a quest, a commitment someone is accountable for.
- The tally text says quorum `reached` is false when no voting power was counted at the snapshot (today's behaviour, to be aligned with the contract after a decision).
- Server instructions: proposals and agreements are identified by slug too, and carry a `url`.
- Every tool description now states it is read-only.
- Tool error text for not found now says "Space or proposal".

## 1.0.0

- First release: server instructions, `hypha_list_spaces`, `hypha_get_my_membership`.
- Output of `hypha_list_spaces`: `governance.exitMethod` is not exposed (the product hardcodes one value and nothing reads it). 1.0.0 was never released, so no version bump.

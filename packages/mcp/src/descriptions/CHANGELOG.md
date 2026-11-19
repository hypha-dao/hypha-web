# Model-facing text changelog

Every change to `index.ts` in this folder needs a `DESCRIPTIONS_VERSION` bump, a snapshot
update and a line here (K31).

## 1.0.0

- First release: server instructions, `hypha_list_spaces`, `hypha_get_my_membership`.
- Output of `hypha_list_spaces`: `governance.exitMethod` is not exposed (the product hardcodes one value and nothing reads it). 1.0.0 was never released, so no version bump.

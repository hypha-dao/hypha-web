# Model-facing text changelog

Every change to `index.ts` in this folder needs a `DESCRIPTIONS_VERSION` bump, a snapshot
update and a line here (K31).

## 1.5.0

- New tool `hypha_list_signals`: the signals of one space, with filters, a summary of the whole filtered set and a legacy `taskFields` group. The text says a signal commits nobody and points to quests for commitments. The server instructions now say that signals carry a `url` too.

## 1.4.0

- `hypha_list_spaces`: new `mine` input (default false). With `mine: true` only the spaces where the user is a member or a delegate are returned, still limited to what the user can see; `total` counts that set. The tool text says when to use it (to answer which spaces the user belongs to) instead of checking spaces one by one.

## 1.3.0

- Text that stands alone for an assistant outside any Hypha repo: the server instructions now say what a sub-space is, that `slug` is the identifier and `title` the display name, how members and delegates differ, and what "visible to you" means; every tool that takes a slug says never to guess it and to find it with `hypha_list_spaces` and `query` first; `hypha_list_spaces` says how to find a space by name, to ask the user when several match, and what `total` counts; `hypha_get_my_membership` says `isMember` and `isDelegate` are independent. The word "quest" now appears only where the `label` is explained.
- Description excerpts and full texts are cut at a word boundary, and a dangling markdown marker is dropped.

## 1.2.0

- `hypha_list_proposals`: new `description` input (`none`, `excerpt` by default, `full`); excerpt is about 500 characters, full is up to 10,000, both flagged in `truncated`; full lowers the page size to 10. The tool text states the default and when to switch.

## 1.1.0

- Added `hypha_get_space`, `hypha_list_proposals` and `hypha_get_my_vote`; tool order is now list spaces, get space, list proposals, get my membership, get my vote.
- `hypha_list_proposals` items carry an additive `label`; the description explains that a `Quest` label marks an agreement that proposes a quest, a commitment someone is accountable for.
- The tally text says that when no voting power was counted at the snapshot, quorum and unity count as reached, as the contract resolves it (decided: follow the contract).
- Server instructions: proposals and agreements are identified by slug too, and carry a `url`.
- Every tool description now states it is read-only.
- Tool error text for not found now says "Space or proposal".

## 1.0.0

- First release: server instructions, `hypha_list_spaces`, `hypha_get_my_membership`.
- Output of `hypha_list_spaces`: `governance.exitMethod` is not exposed (the product hardcodes one value and nothing reads it). 1.0.0 was never released, so no version bump.

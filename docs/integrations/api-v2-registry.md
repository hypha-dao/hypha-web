# `/api/v2` endpoint registry

Client-key-protected read endpoints for integrators (#2515). `/api/v2` mirrors `/api/v1` paths where a
v1 twin exists and adds paths where the data is new. `/api/v1` routes are not modified. Shared logic
lives in `packages/core/src/api-v2` (framework-free); handlers are in `apps/web/src/app/api/v2`.

Every v2 endpoint is exactly one **kind**:

- **mirror**: same input and output as the v1 twin; only key protection (plus the verified token where
  the twin takes one) differs.
- **enriched**: same input; v1 fields unchanged; named fields or blocks added (a superset). A contract
  test asserts the v2 body contains the v1 body unchanged.
- **new**: no v1 twin.

The same five facts (`twin`, `kind`, `adds`, `diverges`, `ui-delegated`) are in the header comment of
each handler; this table is the index.

## Conventions

### Auth

| Header                                       | Meaning                                                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-hypha-client-key`                         | **Required** on every route. Any approved client; no scope. Held by the integrator's server only.                                                           |
| `Authorization: Bearer <Privy access token>` | **Optional** on reads, **required** on `my-vote`. Verified with `verifyPrivyAuthToken`. A token that is present but invalid is a 401, never a silent guest. |

Guests (key alone) may read spaces whose on-chain `access` level is `PUBLIC` only.

### The four-level rule (one rule for the gate and the list)

One pure rule (`packages/core/src/api-v2/visibility-rule.ts`) serves both the **access gate** (level =
the space's `access`) and the **viewer-aware list** (level = `discoverability`), so they cannot drift.
Levels are read from the chain at `latest`.

| Level            | Satisfied by                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PUBLIC (0)       | anyone with an approved client key, guests included                                                                                                                                                          |
| NETWORK (1)      | any verified Hypha user (token + profile + wallet address)                                                                                                                                                   |
| ORGANISATION (2) | direct member or delegate of the space, **or** member/delegate of a DB-organisation sibling, **or** a member of a member-space (a space whose executor is a member of this space): "inside the organisation" |
| SPACE (3)        | direct member, or delegate with a member delegator                                                                                                                                                           |

- **Member of a member-space is org-level**: it can read the space but does not satisfy level 3. v2 is a
  read surface; "may read" must not imply "is inside".
- **Fail closed**: a level or the viewer's relation that cannot be read never grants access and never
  lists a space (single space: 500; list: the space is not listed).
- A space with no `web3SpaceId` has no on-chain setting: the single-space routes treat it as open (as in
  v1); the list does not include it (no level to evaluate).
- **Organisation** = the whole DB tree the space belongs to (climb to the root, take every descendant).

**Divergences, each with its reason** (v1 and the Hypha UI are unchanged; v2 is the specification):

| Topic                    | Hypha UI / v1                                                                                                              | v2                                                        | Reason                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Member of a member-space | UI: space-level (it was added so these viewers can act, e.g. create signals; commit `6422ff681`). v1 gates: not considered | org-level (read)                                          | v2 is read-only; reading must not imply being inside. Aligning the UI/signals is deferred (below) |
| Unreadable level         | UI discoverability: the space is shown (fail open); UI access: hidden                                                      | hidden / denied                                           | the server is the source of truth: it returns only what the viewer is entitled to                 |
| Spaces list              | v1 returns every space                                                                                                     | filtered by default, varies by caller                     | a list that returns hidden spaces to any approved client is not a safe source of truth            |
| Gates                    | v1: two different gates, Neon-RLS bare token and a Postgres `memberships` fallback                                         | one gate, Privy-verified token, no `memberships` fallback | one auditable rule                                                                                |

### The viewer-aware spaces list

`GET /api/v2/spaces` returns **exactly the spaces the viewer may see**; there is no unfiltered mode and
no extra parameter. Guests (client key only) get level-0 spaces; a signed-in viewer gets what the rule
allows; an invalid token is 401. The set of items depends on the viewer; the `include=` blocks on each
item do not. The response varies by caller: `Cache-Control: private, no-store` and
`Vary: Authorization, x-hypha-client-key` (all v2 responses carry these). Filtering happens before
pagination, so `pagination.total` describes what the viewer may see. Clients keep presentation logic
only and never decide "may this user see this".

**Cost** (per request; no per-space reads): levels for all listed spaces in 1 multicall; for a signed-in
viewer, `getMemberSpaces` + `getSpacesForDelegate` (2 reads), 1 multicall for the executors of the
viewer's member spaces, 2 multicalls for the spaces they are listed as delegate of; for level-2 spaces
the viewer is not directly in, 1 multicall for those spaces' members; and 1 DB read of
`(id, parent, web3 id)` for the organisation grouping. Guests need only the levels multicall.

**Cache of chain facts.** Levels, a viewer's spaces/executors and spaces' members are cached in memory
for `CHAIN_FACTS_TTL_MS` = 30 s (stale-if-error up to `CHAIN_FACTS_MAX_STALE_MS` = 120 s; then the key
is absent and callers fail closed). Never cached: the per-viewer response. A space made more private can
still be listed for at most the TTL (30 s) while the chain is healthy, and at most 120 s while it is
unreadable. A new member is visible within the TTL on the list; the single-space gate checks direct
membership live. The cache is per server instance.

**Possible later addition:** a `viewer=membership` block on the list, in a separate opt-in parameter
family (token required; "varies by caller; do not cache as shared"), if a consumer needs per-item
membership. Not built: with the filter, explore needs none and "Join" on a room uses `my-membership`.

### `?include=`

Comma-separated **named blocks by content**; additive, never alter default fields; an unknown name is a
400; there is no `include=all`. Blocks that cannot be read are `null` (unknown), never a silent `0`.

**Rule:** blocks are additive content of the resource, the same for every caller. Viewer-dependent
behaviour is either a `my-*` route that requires the user token (`my-vote`, `my-membership`) or, beyond
the list filter, a separate opt-in parameter family (for example a later `viewer=membership`; token
required, documented as "varies by caller"). It is never an `include=` block. The space resource therefore stays shared and cacheable, and the include set has no
viewer-dependent branches.

**Shared reads (cost).** Per request: on the single space, `governance` and `counts` share one
`getSpaceDetails` read (done once). `visibility` is a separate read from the access gate's own
`access` read, so a request that includes `visibility` reads that value twice (gate + block); not
refactored. On the documents list, `tally` makes N `getProposalCore` reads plus one `getSpaceDetails`,
independent of the gate. On the spaces list, `governance` is a second `getSpaceDetails` multicall
(see the open items).

| Block        | Fields                                                                                          | Cost                                                                                                 | Available on                                                   |
| ------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `visibility` | `discoverability`, `access` (0 PUBLIC, 1 NETWORK, 2 ORGANISATION, 3 SPACE)                      | one batched multicall                                                                                | spaces list, single space                                      |
| `governance` | `quorum`, `unity`, `votingPowerSource` (1 token, 2 member, 3 voice), `joinMethod`, `exitMethod` | one batched `getSpaceDetails` multicall (the list route reads it again; v1's own read is not reused) | spaces list, single space                                      |
| `counts`     | `memberCount`                                                                                   | one `getSpaceDetails`                                                                                | single space (the list already carries `memberCount` as in v1) |
| `tally`      | see below                                                                                       | N x `getProposalCore` + 1 `getSpaceDetails`                                                          | documents list                                                 |

### Chain reads, `asOf`

v2 reads the chain at block tag **`latest`**, like the Hypha UI list and detail. The server helper
`fetchProposalOutcomeSetsForSpace` (and the multicalls behind `getAllSpaces`) read at `safe`, which
lags `latest` and has no stated reason; v2 does not. Responses carry `asOf` (ISO time of the latest
block) and `asOfBlock` (block number, `null` when the block read failed and the server clock was used).
"Now" for `awaitingDecision` and `canVote` is that block time.

### Proposal status

`status` is one of `onVoting | accepted | rejected | withdrawn`, per document, absent **only** when the
document has no `web3ProposalId`.

- `withdrawn` is route-local: the shared `DocumentStatus` and the MCP output enum are not widened.
- `withdrawn` takes precedence over `rejected` (an owner withdraw also lands in the rejected list).
- There is no `expired` status. The contract sets `expired = true` on every unaccepted closure (vote
  rejection, timeout, withdrawal), and the Hypha UI routes `ProposalExpired` through the rejection
  handler, so `rejected` covers both.
- If the outcome lists cannot be read the route is a 502 rather than returning documents with a silently
  missing `status`.

### `tally` block

`startTime`, `endTime` (unix seconds), `executed`, `expired`, `yesVotes`, `noVotes`,
`totalVotingPowerAtSnapshot` (decimal strings), `quorum` {`requiredPercent`, `requiredVotes`,
`progressPercent`, `reached`}, `unity` {`requiredPercent`, `progressPercent`, `reached`},
`awaitingDecision`. No `transactions[]`. `null` for one proposal means its read failed.

- `expired` keeps the contract's name and means **closed unaccepted**, not "timed out".
- `awaitingDecision = now > endTime && !executed && !expired`: closed, outcome not yet recorded on chain
  (it needs a member or delegate to trigger the check). It is not "undecided". It is the list rule; the
  detail banner's duration/quorum/unity guard is a UI stale-read guard and is not part of it.
- `quorum.progressPercent` is **participation**: `(yes + no) / totalVotingPowerAtSnapshot * 100` (0 when
  the snapshot is 0). `unity.progressPercent` is **agreement**: `yes / (yes + no) * 100` (0 when nobody
  voted). Both are rounded to 4 decimals.
- `quorum.requiredPercent`, `unity.requiredPercent` are the space's **current** settings; the contract
  stores only the snapshot total, not the percentages at creation. Contract rules mirrored:
  quorum reached when `yes+no >= ceil(quorum * snapshot / 100)`; unity reached when
  `yes*100 >= unity*(yes+no)`.

### Privacy rule (binding for every v2 route, present and future)

A v2 response never contains sensitive personal data: `email`, `sub` (the Privy subject),
banking/KYC/bank-customer data, `preferredCurrency`, or any other private column of the `people` row.

- A person object is built from an explicit **allowlist** (default deny: a new column is not exposed
  until someone adds it), never from a `select()` of the whole row and never by spreading a DB row.
  Public-profile fields, at most: `slug`, `name`, `surname`, `nickname`, `avatarUrl`
  (`packages/core/src/api-v2/public-profile.ts`).
- v2 returns **no wallet-address arrays** and no roster. Viewer-specific questions are answered by
  `my-*` routes; counts by `memberCount`. A space's own `address` (its wallet) is not personal data and
  stays.
- Start strict: adding a field later is non-breaking, removing one is breaking. A route that needs
  `address` (for example the planned voters or members routes) adds it to its own allowlist, with a
  documented reason.
- The only exception is a person reading their own data (planned `/v2/people/me`), a separate route with
  its own gate.
- Planned `/v2/spaces/{slug}/members` follows this rule (allowlist, no email); only which public-profile
  fields it shows remains open.
- A contract test walks every v2 response fixture and fails on `email`, `sub`, `preferredCurrency`,
  `memberAddresses`, and `address` on a `creator`/`person` object.

### Superset, except explicitly listed omissions

K12 amendment: an enriched v2 route is a superset of its v1 twin **except the omissions listed here**.
The v1 ⊆ v2 contract tests exempt exactly these fields, by name, so any other missing field still fails.

| Route                                                  | Omitted v1 field                                                   | Why                                                                                                                                                                            | UI rule that used it                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `GET /api/v2/spaces` (each item)                       | `memberAddresses`                                                  | minimal exposure (no wallet-address arrays), smaller payload; `memberCount` covers counts, `my-membership` the viewer signal, a roster belongs to the planned `/members` route | the member level of discoverability (levels 2 and 3), now served by the viewer-aware list |
| `GET /api/v2/spaces/{slug}`                            | `memberAddresses` (v1 single space does not carry it; never added) | same                                                                                                                                                                           | none                                                                                      |
| `GET /api/v2/spaces/{slug}/documents` (each `creator`) | `creator.address`                                                  | the creator is rebuilt from the public allowlist (`avatarUrl`, `name`, `surname`, `type`); v1 is unaffected                                                                    | none (display only)                                                                       |

v1 is untouched; its UI consumers are not affected because the Hypha UI does not call v2.

### Handler header convention

Each handler's header comment carries `twin`, `kind`, `adds`, `diverges`, `ui-delegated`. `diverges`
lists every explicit omission and every gate or semantic difference from the twin. No handler returns a
person object that is not built from the allowlist above.

## Registry

| Path                                                         | Kind                  | Twin                                          | Status    | Adds                                                                                                                                                                                               | Diverges                                                                                                                                                                                                                                                                                                                          | UI-delegated                                                                    |
| ------------------------------------------------------------ | --------------------- | --------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET /api/v2/spaces`                                         | enriched              | `GET /api/v1/spaces`                          | **built** | viewer-aware list (only spaces the viewer may see); `include=visibility,governance`; `omitArchived`, `omitSandbox` on every source; optional `page`/`pageSize` (cap 100, after the filter); `asOf` | filtered by default and varies by caller (v1: every space); `private` cache headers; unreadable level or no on-chain id = not listed; member-of-member-space is org-level; omits `memberAddresses`; envelope `{data, pagination, asOf, asOfBlock}` (v1: bare array); `pagination` `null` when neither param is sent; key required | layout, sorting, copy; `memberCount` 0 as unknown (NOT the visibility decision) |
| `GET /api/v2/spaces/{slug}`                                  | enriched              | `GET /api/v1/spaces/[spaceSlug]`              | **built** | `include=visibility,governance,counts`; `asOf`                                                                                                                                                     | v2 access gate (v1 open); unknown space is 404 (v1: 200 `null`); key required                                                                                                                                                                                                                                                     | i18n of levels and methods                                                      |
| `GET /api/v2/spaces/{slug}/documents`                        | enriched              | `GET /api/v1/spaces/[spaceSlug]/documents`    | **built** | per-item `status`; `include=tally`; `asOf`; `state`, `searchTerm`, `order` as v1                                                                                                                   | `pageSize` default 20, cap 100 (v1: 10, no cap); v2 gate instead of bare-token gate; `latest` not `safe`; 502 on outcome-read failure; key required                                                                                                                                                                               | status labels and badges; "Voting closed" wording; polling; detail banner guard |
| `GET /api/v2/spaces/{slug}/documents/{documentSlug}/my-vote` | new                   | none                                          | **built** | `hasVoted`, `vote`, `isMember`, `isDelegate`, `votingPower`, `votingPowerDecimals`, `votingPowerSource`, `canVote`, `reason`                                                                       | token required on any space; document must belong to the space                                                                                                                                                                                                                                                                    | wallet signing; polling and refresh-after-vote; copy for each `reason`          |
| `GET /api/v2/spaces/{slug}/my-membership`                    | new                   | none                                          | **built** | `isMember`, `isDelegate`, `asOf`, `asOfBlock`; both `null` when the space has no `web3SpaceId`                                                                                                     | token required; no content gate: a verified non-member gets `200 {false,false}` (not 403/404); no addresses, no roster                                                                                                                                                                                                            | the Join / hide-Join decision and copy                                          |
| `GET /api/v2/documents/{slug}`                               | enriched              | `GET /api/v1/documents/[documentSlug]`        | `planned` | `status`, `tally` for a single document                                                                                                                                                            | would apply the v2 gate (v1 skips the space check)                                                                                                                                                                                                                                                                                | as documents list                                                               |
| `GET /api/v2/documents/{slug}/voters`                        | enriched (fixed twin) | `GET /api/v1/documents/[documentSlug]/voters` | `planned` | keeps voters with no DB person (`{address, person\|null, vote}`); case-insensitive vote label; paginated                                                                                           | fixes v1's case-sensitive label and dropped unmapped addresses                                                                                                                                                                                                                                                                    | name/avatar rendering                                                           |
| `GET /api/v2/spaces/{slug}/members`                          | enriched              | `GET /api/v1/spaces/[spaceSlug]/members`      | `planned` | v2 gate, key                                                                                                                                                                                       |                                                                                                                                                                                                                                                                                                                                   |                                                                                 |
| `GET /api/v2/people/me`                                      | mirror                | `GET /api/v1/people/me`                       | `planned` | key protection                                                                                                                                                                                     | v0 keeps `people/me` on v1 (bare token; not key-protected; revisit with #2533)                                                                                                                                                                                                                                                    |                                                                                 |

Existing integration routes (`/api/v1/integration-grants`, request and ops routes) stay under `/api/v1`;
their placement is a separate call. M4 (the server-signed vote) is a separate step after these routes.

## Responsibility ledger

What moved from UI logic into the endpoint, and what stays in the app, so a later UI migration knows
what it can drop.

| Endpoint                                                 | Moves to the endpoint                                                                                                                                                                                                                                       | Stays in the UI / app                                                                                                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v2/spaces`                                         | on-chain visibility and governance reads per space (batched); `omitArchived`/`omitSandbox` on every source; **the discoverability/access rule for the viewer** (who may see which space, incl. members, delegates, organisation siblings and member-spaces) | layout, sorting and copy; `memberCount` 0 as unknown; map and list presentation                                                                                                     |
| `GET /v2/spaces/{slug}`                                  | access gate; visibility, governance and member count                                                                                                                                                                                                        | i18n labels for levels and join/exit methods; empty and unknown rendering                                                                                                           |
| `GET /v2/spaces/{slug}/documents`                        | status derivation (accepted / rejected / withdrawn / onVoting from the on-chain lists, withdrawn precedence); `awaitingDecision`; quorum and unity progress; `latest` reads                                                                                 | status labels and badges; "Voting closed" wording for `onVoting` + `awaitingDecision`; polling and refresh-after-vote; the detail banner's stale-read guard (duration/quorum/unity) |
| `GET /v2/spaces/{slug}/documents/{documentSlug}/my-vote` | member / delegate eligibility; per-user vote lookup (case-insensitive); current voting power and its source; `canVote` and `reason` (necessary conditions)                                                                                                  | wallet signing and submission; polling and refresh-after-vote; text for each `reason`; subscription-state messaging                                                                 |
| `GET /v2/spaces/{slug}/my-membership`                    | member / delegate eligibility for the caller (one shared on-chain read, also used by `my-vote`)                                                                                                                                                             | the Join / hide-Join decision and copy; treating `null` as unknown                                                                                                                  |

## `my-vote` semantics

| Field               | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hasVoted`, `vote`  | from `getProposalVoters`, matched case-insensitively; `vote` is `yes`, `no` or `null`                                                                                                                                                                                                                                                                                                                                                                                           |
| `isMember`          | the contract's `isMember`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `isDelegate`        | listed delegate **and** at least one of its delegators is a member (what `vote` enforces)                                                                                                                                                                                                                                                                                                                                                                                       |
| `votingPower`       | the **current** `getVotingPower` view (live value, not the weight recorded at vote time; source 3 applies decay at vote time, so it may differ slightly). The recorded weight of an existing vote is not returned (events are not read). Decimal string; `votingPowerDecimals` is 0 for source 2, 18 otherwise                                                                                                                                                                  |
| `canVote`, `reason` | **necessary conditions only**: proposal not withdrawn/closed, inside its window, member or delegate, power > 0. The contract also requires an active space subscription (unless the proposal targets the Hypha token), so `true` is not a guarantee. Re-voting is allowed, so `hasVoted` does not block. First failing reason wins: `proposal_withdrawn`, `proposal_closed`, `voting_not_started`, `voting_ended`, `not_member_or_delegate`, `no_voting_power`, else `eligible` |

## Open items for the Hypha team

- **`safe` vs `latest`.** v1 consumers (explore `documentCount`, `overview-activity`, MCP) still read
  at `safe`, which lags the UI by minutes; v2 reads at `latest`. The two can disagree briefly right
  after a final vote, and migrating those consumers to the shared v2 functions will shift their numbers.
  The `safe` tag has no stated reason in history (incidental, copied into the status helper).
- **Response conventions.** v2 keeps v1's plain `{data, pagination}` envelope and `{error, message}`
  errors. A standard (additive HAL `_links` / RFC 8288 `Link` headers for paging, RFC 9457
  `problem+json` for errors) is a convention decision to take across v1 and v2, not per route. JSON:API
  is not compatible with the "v2 is a superset of v1" rule.
- **List `governance` block** costs a second `getSpaceDetails` multicall because `getAllSpaces`
  discards what it already fetched (at `safe`). An opt-in on `getAllSpaces` would remove it; deferred.

- **Signal creation (and other "may act" rules) are not aligned with v2.** The Hypha UI lets members of a
  member-space act (it created a "space-level" state for them); v2 treats them as org-level (read only).
  Deferred: define a separate explicit "may act" rule when signals/actions move behind v2 endpoints, and
  align the UI to the v2 specification then. Until then the two differ, recorded in the divergence table.
- **Server-only access principle.** v2 is the only integrator surface: the chain, the database and Matrix
  are reached through the server, never directly by a client. This is already true for integrators (they
  hold only a client key). Real-time Matrix features will need a server-side proxy or scoped tokens,
  to be designed when they are added to v2.
- **`parentOnly` default on the spaces list.** Absent the parameter, `GET /api/v2/spaces` returns
  top-level spaces only (inherited from the v1 core query, which defaults `parentOnly` to `true`), so
  sub-spaces are omitted. Callers that want every space the viewer may see pass `parentOnly=false`. Whether
  v2 should default to `false` (a deliberate divergence from v1) is open; until decided, v2 mirrors v1.
- **Cache is per instance.** The chain-facts cache is in memory per server instance; a shared store would
  tighten the staleness window across instances and is not needed yet.

## Status codes

`400` unknown `include` block; `401` missing/invalid client key, missing/invalid token, or a token
required for a non-public space or `my-vote`; `403` client not approved, no Hypha profile, or not a
member; `404` unknown space or document (or document not in the space); `my-membership` answers `200` with `false` flags for a verified non-member, never 403/404; the `my-*` routes check the token **before** the space or document exists, so a guest asking for an unknown slug gets 401 before 404 (a deliberate order: nothing about existence is revealed before authentication; the other space-scoped routes look the space up first); `502` a chain read the response
depends on failed; `500` unexpected, or the access level could not be read (fails closed).

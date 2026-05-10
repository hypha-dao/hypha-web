# Technical Specification - DHO Home Token Holdings Dashboard

## Document control

| Field | Value |
| --- | --- |
| Status | Draft |
| Scope | Add `Home` as first DHO menu item and show a token holdings dashboard on the overview surface. |
| Primary goal | Show one pie chart per token minted by the space with member/space/treasury context. |
| Data contract | Add a new read-only MCP tool for token holdings and reuse the same backend source in web UI. |

---

## 1) Problem statement

The DHO experience does not currently expose a clear first-class `Home` entry with immediate transparency into token distribution.

We need a first-position `Home` menu item that opens a dashboard showing:

- one pie chart per token minted by the space
- holdings by member / space member / treasury / other
- clear percentages and totals with hover details
- visuals coherent with the existing Hypha app style

---

## 2) UX goals

- Add `Home` as the first item in DHO navigation.
- Keep the page native to existing UI patterns (cards, subtle surfaces, readable charts).
- Make distribution understandable at a glance, with exact values available in legend/tooltip.
- Support desktop and mobile layouts.
- Cover loading, empty, and error states.

---

## 3) Information architecture

### 3.1 Navigation

- Insert `Home` in first position of DHO navigation.
- Keep `overview` as the canonical URL segment for compatibility:
  - `/{lang}/dho/{id}/overview`
- Replace existing overview content with the new Home dashboard (no parallel legacy overview view).
- Use `Home` as the UI label while preserving `overview` in route helpers/constants to avoid URL mismatch.
- Keep route compatibility and active-state behavior stable.

### 3.2 Page purpose

`Home` becomes the canonical transparency surface with:

- minted token summary
- per-token pie/donut charts
- holder context (member, space member, treasury, other)

---

## 4) Source of truth

### 4.1 Space-issued token list

- Chain source: `fetchSpaceDetails(...).tokenAddresses`
- Metadata source: `packages/storage-postgres/src/schema/tokens.ts`

### 4.2 Holdings resolution

Use shared core helpers for deterministic output:

- `findSpaceBySlug`
- `checkSpaceAccessForSpace`
- `fetchSpaceDetails`
- token metadata + balance helpers (`getTokenMeta`, `getTokenDecimals`, `getTokenBalancesByAddress`)
- roster/member resolvers

---

## 5) MCP contract

### 5.1 Tool name

Create read-only MCP tool:

- `get_token_holdings_by_space_slug`

### 5.2 Input schema

- `space_slug` (required)
- optional: `include_zero_balances` (default false)
- optional: `holder_limit` (default unlimited)
- optional: `include_treasury` (default true)

### 5.3 Output shape (recommended)

```ts
{
  found: boolean;
  space_slug: string;
  space: {
    id: number;
    slug: string;
    title: string;
    parent_id: number | null;
    web3_space_id: number | null;
  } | null;
  source: 'db+chain';
  asOf: string; // ISO-8601
  tokens: Array<{
    token_id: number | null;
    token_address: `0x${string}`;
    name: string;
    symbol: string;
    icon_url: string | null;
    type: string;
    decimals: number;
    max_supply: string | number | null;
    total_supply: string;
    holdings: Array<{
      holder_kind: 'person' | 'space' | 'treasury' | 'other';
      address: `0x${string}` | null;
      display_name: string;
      slug: string | null;
      balance: string;
      balance_raw: string;
      share_pct: number;
    }>;
    treasury_balance: string;
    other_balance: string;
    total_holders_balance: string;
  }>;
}
```

### 5.4 Access control

Follow existing MCP read-tool semantics:

- if `web3SpaceId` exists, validate with `checkSpaceAccessForSpace(host, HYPHA_MCP_AUTH_TOKEN)`
- return `isError: true` with human-readable reason on denial
- keep public spaces readable

### 5.5 Error response shape

```ts
{
  isError: true;
  found: boolean;
  space_slug: string;
  reason: string; // human-readable message
  error_code?: 'access_denied' | 'not_found' | 'invalid_input' | 'server_error';
}
```

### 5.6 Tool conventions

- zod input/output schemas
- `safeParse` for input/output
- `structuredContent` on success
- concise textual `content` summary
- `readOnlyHint: true`, `idempotentHint: true`

---

## 6) UI requirements

### 6.1 Layout

1. Header: title, short description, optional "updated at"
2. Responsive token card grid (1 card per token)
3. Optional summary strip: token count, total minted, holders, treasury share

### 6.2 Chart behavior

- use D3 for chart rendering (no Recharts abstraction for this feature)
- one chart per token
- readable legend and tooltip with exact amount + share
- stable color mapping per token/slice
- collapse holders with `< 3%` share into `Other` by default
- always keep `Treasury` as its own visible slice; never collapse treasury into `Other`
- when holdings/recipient classification maps to treasury (including executor-address treasury), label and render as `Treasury`
- donut center can show token symbol + tracked total

### 6.2.1 D3 implementation notes

- use `d3-shape` for pie/arc generation
- use `d3-scale` for deterministic slice color mapping
- use `d3-format` for percentages and numeric labels
- keep chart rendering deterministic between SSR and client hydration
- expose text fallbacks for all visual-only values

### 6.3 States

- Loading: skeleton cards
- Empty: no minted token friendly message
- Error: actionable and access-aware message

### 6.4 Accessibility

- chart/legend labels available to screen readers
- hover-only data mirrored in text
- token cards expose token identity + totals + top-holder breakdown

---

## 7) Implementation plan

### Phase 0 - Decisions and scope lock (required before coding)

**Goal:** remove ambiguity so implementation does not fork.

- Resolve remaining open questions in Section 9 and record final decisions.
- Route behavior already locked: `Home` label maps to `overview` URL and replaces legacy overview content.
- Holder bucketing threshold already locked: `< 3%` collapses into `Other`.
- Treasury visibility already locked: treasury is always a dedicated slice.
- Data path already locked: Home reads via a dedicated API route mirroring MCP output.

**Deliverable:** signed-off "v1 behavior" note in this spec.
**Exit gate:** no unresolved product decisions blocking backend or UI.

### Phase 1 - Data contract and shared core helper

**Goal:** create one source of truth used by MCP and web.

- Define final TypeScript + zod contract for token holdings payload.
- Implement shared holdings helper in core:
  - resolve space by slug
  - resolve minted token list from chain + DB metadata
  - resolve holder balances and compute percentages
  - compute `treasury_balance`, `other_balance`, and totals
- Add deterministic sorting (token order and holder order) for stable rendering.

**Deliverable:** reusable server helper with schema-validated output.
**Exit gate:** unit tests pass for aggregation and bucket math.

### Phase 2 - MCP tool implementation

**Goal:** expose holdings data through MCP with existing security semantics.

- Add `get_token_holdings_by_space_slug` tool registration.
- Implement input validation + output `safeParse`.
- Enforce access checks for gated spaces and return `isError: true` on denial.
- Return structured payload + concise human-readable summary.

**Deliverable:** production-ready read-only MCP tool.
**Exit gate:** MCP tool integration test covers success, not-found, and denied access.

### Phase 3 - AI agent integration on top of MCP

**Goal:** enable agent workflows only after MCP contract is stable.

- Update agent tool guidance/system prompt usage to call `get_token_holdings_by_space_slug` for token distribution questions.
- Ensure tool selection prefers this MCP path for holdings/transparency prompts.
- Validate agent responses reflect the same bucket logic (`Treasury`, `< 3%` to `Other`) as UI/API.

**Deliverable:** AI agent integration that consumes the MCP tool reliably.
**Exit gate:** agent test prompts confirm correct tool usage and output interpretation.

### Phase 4 - Navigation wiring and page shell

**Goal:** make Home visible and routable as the first DHO entry.

- Insert `Home` as first DHO navigation item.
- Ensure route mapping to `/{lang}/dho/{id}/overview`.
- Verify active-state behavior in all DHO tab contexts.
- Add Home page shell (header, summary placeholders, grid container).

**Deliverable:** navigable Home entry with stable route behavior.
**Exit gate:** nav order + route tests pass.

### Phase 5 - D3 chart components and dashboard UI

**Goal:** deliver final visualization experience.

- Build reusable D3 chart primitives (pie/donut):
  - `d3-shape` arcs
  - `d3-scale` color mapping
  - `d3-format` value/percent labels
- Implement token chart cards, legends, center labels, and responsive grid.
- Implement loading, empty, and error states.
- Add accessible text equivalents for all chart-only data.

**Deliverable:** full D3-based token dashboard UI.
**Exit gate:** UI review approved on desktop + mobile breakpoints.

### Phase 6 - Data integration and performance hardening

**Goal:** connect real data safely and keep rendering stable.

- Implement a dedicated Home API route that mirrors MCP output shape.
- Wire Home page data fetching to that dedicated API route.
- Keep the dedicated API route backed by the same shared helper used by MCP.
- Ensure SSR/client output is deterministic to avoid hydration mismatch.
- Add caching strategy for holdings reads (short TTL + explicit invalidation policy).
- Add defensive handling for partial token metadata and unknown holders.

**Deliverable:** end-to-end data flow from backend to charts.
**Exit gate:** no hydration warnings; acceptable response time on representative spaces.

### Phase 7 - Validation, rollout, and handoff

**Goal:** ship confidently with test coverage and operational clarity.

- Automated tests:
  - helper math and bucket tests
  - MCP tool contract tests
  - nav order and route tests
  - UI state tests (loading/empty/error/data)
- Manual QA:
  - public and gated spaces
  - small and high-cardinality holder sets
  - responsive and accessibility checks
- PR checklist and rollout notes:
  - migration notes (if any)
  - feature flag strategy (if used)
  - post-merge verification steps

**Deliverable:** merge-ready PR with QA evidence.
**Exit gate:** acceptance criteria in Section 8 fully satisfied.

---

## 8) Acceptance criteria

- `Home` is first in DHO navigation.
- Home displays one chart per token minted by the space.
- Each chart exposes holdings context: member/space/treasury/other.
- Holders below `3%` share are collapsed into `Other` by default.
- Treasury is always shown as its own slice, including executor-address treasury recipients.
- Visual style matches existing Hypha surfaces.
- Token charts are implemented with D3.
- Home data is loaded through a dedicated API route that mirrors MCP output.
- MCP tool returns structured holdings with existing access semantics.
- AI agent integration uses the MCP tool for holdings/transparency requests.

---

## 9) Decision log

- Home/overview routing is finalized:
  - `Home` is the product label in navigation.
  - `/{lang}/dho/{id}/overview` remains the canonical URL.
  - Existing overview content is replaced by the new Home dashboard.
- `Other` slice threshold is finalized:
  - holders with `< 3%` share are collapsed into `Other` by default.
- Treasury slice behavior is finalized:
  - treasury is always rendered as its own slice.
  - executor-address treasury recipients are labeled as `Treasury`.
- UI data path is finalized:
  - Home uses a dedicated API route.
  - the API response mirrors MCP output.
  - both API and MCP are backed by the same shared helper.

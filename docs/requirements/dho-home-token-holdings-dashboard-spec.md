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
- Route to existing overview path:
  - `/{lang}/dho/{id}/overview`
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

### 5.5 Tool conventions

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

- one chart per token
- readable legend and tooltip with exact amount + share
- stable color mapping per token/slice
- collapse high-cardinality tail into `Other` when needed
- donut center can show token symbol + tracked total

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

### Step 1 - Finalize data contract

- lock input/output schema
- lock bucket semantics (member, space, treasury, other)

### Step 2 - Implement MCP tool

- build shared core helper for holdings aggregation
- register `get_token_holdings_by_space_slug` in MCP server
- enforce read-only and access checks

### Step 3 - Wire Home navigation

- add `Home` as first DHO item
- map to `overview` route and ensure active-state correctness

### Step 4 - Build dashboard components

- create token holdings dashboard surface
- render chart cards, legends, totals, and responsive layout

### Step 5 - Connect data loading

- fetch from server path backed by same helper as MCP tool
- keep rendering deterministic and cache-friendly

### Step 6 - Validate

- test nav order and route behavior
- test loading/empty/error states
- test MCP schema + output validation
- test access behavior on public and gated spaces

---

## 8) Acceptance criteria

- `Home` is first in DHO navigation.
- Home displays one chart per token minted by the space.
- Each chart exposes holdings context: member/space/treasury/other.
- Visual style matches existing Hypha surfaces.
- MCP tool returns structured holdings with existing access semantics.

---

## 9) Open questions

1. Should Home replace current overview content completely or coexist with a moved overview surface?
2. Should small holders always collapse into `Other` by default?
3. Should treasury always be a dedicated slice when represented by executor address?
4. Should UI read directly from shared helper or via dedicated API route mirroring MCP output?

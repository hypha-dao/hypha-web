# Technical Specification — DHO Home token-holdings dashboard

## Document control

| Field | Value |
|-------|--------|
| **Status** | Draft |
| **Scope** | Add a first-position `Home` menu item for DHO space pages and replace the current Home/overview surface with a token-holdings transparency dashboard. |
| **Primary goal** | Show one pie chart per token minted by the space, with holdings per member and space member context, in a design coherent with the rest of Hypha. |
| **Data contract** | Introduce a new read-only MCP tool for token holdings so the data model stays consistent with the existing MCP architecture. |

---

## 1) Problem statement

The current DHO navigation does not expose a clear "Home" entry, and there is no dedicated transparency surface that lets someone entering a space immediately understand how the space-issued tokens are distributed.

We need a first-position `Home` menu item that opens a dashboard showing:

- one pie chart per token minted by the space
- token holdings by member / space member / treasury context
- clear, readable totals and percentages
- a design that feels native to the rest of the app

This must use a new MCP tool for holdings data, following the same patterns as the existing Hypha MCP server tools.

---

## 2) UX goals

- Add `Home` as the first item in the DHO main menu.
- Make the dashboard feel like a natural part of the app, not a separate analytics tool.
- Make the distribution readable at a glance, with exact values available on hover or click.
- Keep the layout responsive and usable on mobile and desktop.
- Avoid visual clutter: no dense tables on first load, no raw blockchain noise.
- Preserve transparency: anyone entering the space should be able to understand the token distribution context quickly.

## 3) Information architecture

### 3.1 Navigation

- Insert `Home` in the first position of the main DHO side navigation.
- `Home` should route to the existing overview path:
  - `/{lang}/dho/{id}/overview`
- The current non-Home dashboard experience should remain reachable from the rest of the app if needed, but this route becomes the primary landing surface for the space.

### 3.2 Page purpose

The Home page is the canonical transparency view for the space:

- summary of minted tokens
- per-token pie/donut charts
- member and space-member holdings context
- treasury balance visibility

---

## 4) Source of truth

### 4.1 Space-issued tokens

Use the space's on-chain token configuration as the authoritative list of tokens minted by the space.

Recommended source pairing:

- `fetchSpaceDetails(...).tokenAddresses` for the authoritative on-chain token list
- `packages/storage-postgres/src/schema/tokens.ts` for token metadata (`name`, `symbol`, `iconUrl`, `type`, `maxSupply`, `archived`, `spaceId`)

### 4.2 Holdings data

Holdings should be resolved from a new MCP tool backed by the same chain helpers already present in the monorepo.

Recommended helper building blocks:

- `findSpaceBySlug`
- `checkSpaceAccessForSpace`
- `fetchSpaceDetails`
- `getTokenMeta` / `getTokenDecimals`
- `getTokenBalancesByAddress`
- existing roster helpers for resolving members and space members

---

## 5) MCP contract

## 5.1 Tool name

Create a new read-only MCP tool:

- `get_token_holdings_by_space_slug`

This name follows the existing `get_*_by_space_slug` convention and stays consistent with the current server patterns.

## 5.2 Intended behavior

The tool returns a structured transparency payload for a space:

- the space identity and title
- the token list minted by the space
- per-token holdings breakdown
- treasury / other balance context
- non-zero balances only, plus an "other" aggregate if needed

## 5.3 Input schema

Minimum v1 input:

- `space_slug` (required)

Optional v1 extensions, if needed for payload control:

- `include_zero_balances` (default: false)
- `holder_limit` (default: no limit)
- `include_treasury` (default: true)

## 5.4 Output shape

Recommended structured output:

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

## 5.5 Access control

Use the same access logic as the existing MCP read tools:

- if the space has a `web3SpaceId`, call `checkSpaceAccessForSpace(host, HYPHA_MCP_AUTH_TOKEN)`
- return a text error and `isError: true` on denial
- public spaces remain readable without auth

## 5.6 MCP server conventions

The new tool MUST follow the existing MCP patterns:

- Zod input and output schemas
- `safeParse` on input and output
- `structuredContent` in success cases
- short human-readable `content` summary
- `readOnlyHint: true`
- `idempotentHint: true`

---

## 6) UI requirements

## 6.1 Home page layout

The page should use the same visual language as the rest of the app:

- card-based layout
- subtle borders and rounded corners
- readable typography
- coherent spacing with the existing DHO screens

Recommended structure:

1. Page header
   - `Home`
   - short explanatory subtitle about transparency / holdings
   - optional last-updated time

2. Token dashboard grid
   - one card per token minted by the space
   - each card contains a pie/donut chart
   - chart legend shows member / space member / treasury / other slices

3. Optional summary strip
   - token count
   - total minted supply
   - total holders
   - treasury share

## 6.2 Pie chart behavior

- One chart per token.
- Each chart shows holdings distribution for that specific token.
- Use the same token colors everywhere on the page.
- Slice labels should be readable on hover and in the legend.
- Large "other" balances should collapse into an `Other` slice when the holder count is high.
- The center of each donut can show:
  - token symbol
  - total supply or total tracked supply

## 6.3 Empty / loading / error states

- Loading state should use skeleton cards.
- If no tokens are minted by the space, show a friendly empty state.
- If holdings are unavailable, explain whether the space lacks on-chain token data or the user lacks access.

## 6.4 Responsiveness

- Mobile: stacked cards, full-width charts.
- Desktop: responsive grid, ideally 2-up or 3-up depending on viewport.
- The layout should never overflow horizontally.

## 6.5 Accessibility

- Charts need accessible labels and keyboard-readable legends.
- Each token card should expose:
  - token name
  - token symbol
  - total supply
  - top holders / share breakdown
- Hover-only information must also be available in text form.

---

## 7) Design notes

- Keep the visual tone aligned with existing Hypha surfaces:
  - soft borders
  - rounded-xl / rounded-2xl cards
  - muted backgrounds
  - accent highlights for the selected / primary token
- Avoid overly technical blockchain styling.
- Prefer calm, transparent, readable analytics over flashy crypto aesthetics.
- The chart page should feel like a native Hypha product screen, not a dashboard embedded from a third-party analytics tool.

---

## 8) Implementation plan

### Step 1 - Define the data contract

- Add the new MCP input/output schemas.
- Decide which balance buckets are returned:
  - members
  - space members
  - treasury
  - other
- Confirm the source of token metadata from the `tokens` table and chain token addresses.

### Step 2 - Add the MCP tool

- Implement the core helper that gathers:
  - the space record
  - the minted token list
  - holder balances per token
  - treasury / other aggregates
- Register `get_token_holdings_by_space_slug` in `packages/mcp-server/src/main.ts`.
- Keep the tool read-only, idempotent, and access gated.

### Step 3 - Add the Home route surface

- Reuse the existing `overview` route as the Home landing path.
- Update the main DHO side navigation so `Home` is the first item.
- Ensure the nav active state resolves correctly on the overview route.

### Step 4 - Build the dashboard UI

- Create a token-holdings dashboard component for the Home page.
- Render one chart card per token.
- Add legends, hover states, and totals.
- Reuse existing app primitives for cards, badges, avatars, separators, and loading states.

### Step 5 - Integrate data loading

- Wire the page to a server-side data fetch path that uses the same underlying data source as the MCP tool.
- Keep the page rendering deterministic and cache-friendly.

### Step 6 - Polish and QA

- Validate responsive behavior on narrow and wide screens.
- Add or update tests for:
  - nav ordering
  - Home route rendering
  - empty state
  - MCP tool schema / output validation
- Verify access control on public and restricted spaces.

---

## 9) Acceptance criteria

- `Home` appears first in the DHO main navigation.
- The Home page shows one pie chart per token minted by the space.
- The dashboard shows holdings per member / space member / treasury context.
- The page matches the visual system used elsewhere in the app.
- Token holdings are available through the new MCP tool with the same access semantics as other Hypha MCP tools.
- The implementation is ready for incremental follow-up without needing a rewrite.

---

## 10) Open questions

1. Should `Home` fully replace the current overview/subspace visualization, or should the existing visualization move to another route?
2. Should the pie chart include every non-zero holder slice, or should higher-cardinality spaces collapse small holders into `Other` by default?
3. Should treasury be shown as a dedicated slice even when it is the space executor address?
4. Should the web page reuse the same helper as the MCP tool, or should the page read from a dedicated API route that is mirrored by the MCP tool?


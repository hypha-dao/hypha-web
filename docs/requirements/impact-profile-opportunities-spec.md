# Technical Specification — Impact Profile & Opportunities Network

## Document control

| Field | Value |
| --- | --- |
| Status | Draft — ready for implementation |
| Scope | Space **Impact** tab (qualitative funding profile), **Story** signal type, inline block editor, support CTAs, and **Opportunities** network marketplace |
| Primary surfaces | DHO `@tab/impact`, Network explore (`ExploreSpaces`), Coherence signals |
| Inspiration | [Homa Bay Scholarship Fund 2026](https://www.mycause.com.au/page/386667/homa-bay-scholarship-fund-2026) — narrative sections, progress proof, use-of-funds, urgency, support CTAs |
| Out of scope (v1) | Public donor feed, automated goal-vs-treasury reconciliation, governance-gated publish proposals |

---

## 1) Problem statement

Spaces need a **qualitative, image-rich public profile** that explains who they are, what resources they need, and how supporters can help — without requiring members to leave Hypha or rely on external campaign pages.

Resource providers (donors, investors, partners) need a **marketplace view** on the Network where spaces that opt in can showcase their ask. Clicking a card opens the space Impact page with clear CTAs linked to treasury wallet or IBAN.

Today Hypha has:

- Overview dashboards (metrics) but no narrative funding profile
- Coherence signals (Opportunity, Risk, Tension, Insight) but no **Story** type for achievements/events
- Treasury deposit flows (wallet, Bridge IBAN) but no public-facing support bar on a showcase page
- Network list/map with discoverability filters but no **Opportunities** view for published funding asks

---

## 2) Naming & routing

| Concept | Name | Route / identifier |
| --- | --- | --- |
| Space tab (first in nav) | **Impact** | `/{lang}/dho/{slug}/impact` |
| Network marketplace view | **Opportunities** | `/{lang}/network?view=opportunities` |
| New signal type | **Story** | `coherences.type = 'Story'` |
| Opt-in publish flag | `impactPublished` | `space_impact_profiles.published` |
| i18n namespace | `ImpactTab` | All locales in `packages/i18n/src/messages/` |

**Rationale:** *Impact* covers mission, needs, stories, and support CTAs without sounding purely transactional. *Opportunities* is clear for resource providers browsing funding asks.

---

## 3) UX goals

- **Impact tab is first** in DHO navigation — the primary public-facing story of the space.
- Members edit the page **inline** with `+` to add sections, reorder blocks, and upload gallery images.
- **Story signals** feed an achievements timeline (visits, events, milestones).
- **Support bar** (Donate / Invest / Support) links to space wallet address or Bridge IBAN deposit instructions.
- Spaces **opt in** to share their ask on the Network Opportunities view (list, map, dedicated view).
- Mobile-first sticky support bar; loading, empty, draft, and unpublished states covered.

---

## 4) Information architecture

### 4.1 Impact tab layout

```
┌─────────────────────────────────────────────────────────┐
│  Hero: banner + logo + title + location + tagline       │
│  [Edit mode toggle — members only]                       │
├─────────────────────────────────────────────────────────┤
│  Support bar (sticky on scroll)                         │
│  Goal: €50,000 · optional progress display (v1 static)  │
│  [Donate] [Invest] [Support]  → treasury rails          │
├─────────────────────────────────────────────────────────┤
│  § About us                                    [+ edit] │
│  § What we've achieved (Stories feed)          [+ add]  │
│  § What we need now                            [+ edit] │
│  § How resources will be used                  [+ edit] │
│  § Why support now                             [+ edit] │
│  § Gallery                                     [+ add]  │
│  § Contact & links                             [+ edit] │
├─────────────────────────────────────────────────────────┤
│  Publish settings (members only)                        │
│  ☐ Share this ask on the Hypha Opportunities network    │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Recommended block types (inline-editable)

| Block type | Purpose | Images |
| --- | --- | --- |
| `about` | Who we are — rich text | Optional hero |
| `mission` | Why we exist — statement + values | Optional |
| `needs` | Qualitative funding ask + optional target amount | — |
| `useOfFunds` | Numbered/bulleted breakdown | Optional |
| `whyNow` | Urgency, deadline, milestone framing | — |
| `gallery` | Visual proof | 1–12 images + captions |
| `location` | Where work happens | Map thumbnail from space geo |
| `links` | External proof (prior campaigns, reports) | — |
| `cta` | Thank-you + invitation copy | — |
| `stories` | Achievements feed | Auto from Story signals |

**Default template** (empty state → “Start from template”):

1. About us  
2. What we've achieved (Stories)  
3. What we need now  
4. How resources will be used  
5. Why support now  
6. Gallery  
7. Support CTA  

### 4.3 Network Opportunities view

Extend `/network` with `view=opportunities` (alongside existing `list` and `map`):

| View | Behavior |
| --- | --- |
| List | Existing space cards + optional impact badge when published |
| Map | Existing pins; popup includes impact summary when published |
| **Opportunities** | Grid/list of **published impact profiles only** |

Card click → `/{lang}/dho/{slug}/impact` (not overview).

**Opportunity card fields:**

- Cover image (`impactCoverImage` or `leadImage`)
- Title, location label
- Summary teaser (160 chars)
- Optional goal badge (“Seeking €50k”)
- CTA: “View impact →”

---

## 5) Story signal type

### 5.1 Type definition

Add to `COHERENCE_SIGNAL_TYPES` in `packages/core/src/coherence/coherence-types.ts`:

```typescript
'Story'  // achievements, events, visits, milestones
```

No DB migration required — `coherences.type` is free `text`, validated in app layer.

### 5.2 Semantics

Story signals are **narrative proof**, not workflow items. They appear on the Impact tab and optionally in Coherence with a “Story” filter.

| Field | Usage |
| --- | --- |
| `title` | Headline |
| `description` | Narrative body |
| `type` | `Story` |
| `attachments` | Event/visit photos |
| `metadata.eventDate` | When the event happened (optional JSON) |
| `metadata.location` | Optional |

### 5.3 Creation UX

“Add story” on Impact tab → lightweight form (title, date, photos, body) → creates coherence row with `type: 'Story'`.

Display: reverse-chron timeline; card shows image, date, excerpt, “Read more”.

### 5.4 i18n

Add `CoherenceTab.types.Story` and `CoherenceTab.typeDescriptions.Story` in all locale files.

---

## 6) Support CTAs

Space admins configure **1–3 enabled CTAs** with labels and destination rails.

### 6.1 Configuration schema

```typescript
type ImpactSupportAction = {
  id: string;
  label: 'donate' | 'invest' | 'support' | 'custom';
  customLabel?: string;
  enabled: boolean;
  destination: 'wallet' | 'iban' | 'bank_rail' | 'external_url';
  walletAddress?: string;      // space executor (resolved from treasury)
  bankingRail?: 'eur' | 'usd-ach' | 'usd-wire' | 'gbp' | string;
  externalUrl?: string;
  copyInstructions?: string;  // e.g. "Include reference: SPACE-SLUG"
};
```

### 6.2 Runtime behavior

| CTA | Action |
| --- | --- |
| **Donate** | Modal: copy wallet address or show IBAN/deposit instructions from `deposit-instructions-card` |
| **Invest** | Link to governance `accept-investment` flow or treasury deposit with investment copy |
| **Support** | Share page, copy IBAN, or contact link |

**Reuse existing components:**

- `packages/epics/src/treasury/hooks/use-fund-wallet.ts`
- `packages/epics/src/banking/components/deposit-instructions-card.tsx`
- Space executor address from treasury assets API

**Fallback:** If banking not configured, CTA falls back to crypto wallet or hides with “Contact space” message.

---

## 7) Publish model

### 7.1 Settings (separate from transparency)

| Setting | Effect |
| --- | --- |
| `discoverability` (existing on-chain) | Can space be found on network at all? |
| **`impactPublished`** (new) | Shows in Opportunities view + impact card on list/map |
| `impactPublishedAt` | Sort “recently published” |
| `impactSummary` | Card teaser (max 160 chars) |
| `impactCoverImage` | Card image; defaults to `leadImage` |
| `impactGoalAmount` / `impactGoalCurrency` | Optional display-only goal |

### 7.2 Publish validation

`impactPublished === true` requires:

- Discoverability ≥ `NETWORK` (or `PUBLIC`)
- At least **about** + **needs** blocks filled
- At least **one** enabled support CTA

### 7.3 Permissions

| Viewer | Impact tab | Edit | Publish | See CTAs (IBAN/wallet) |
| --- | --- | --- | --- | --- |
| Anonymous | If `impactPublished` | No | No | If published + CTA enabled |
| Network user | If published | No | No | Yes |
| Member | Always | Yes | Yes | Yes |
| Delegate | Always | Yes | Yes | Yes |

Never expose IBAN/wallet in API unless `impactPublished` or caller is member. Reuse `checkSpaceAccess` + transparency checks from `packages/epics/src/spaces/utils/transparency-access.ts`.

---

## 8) Data model

### 8.1 New table: `space_impact_profiles`

```typescript
// packages/storage-postgres/src/schema/space-impact-profile.ts
spaceImpactProfiles = pgTable('space_impact_profiles', {
  id: serial('id').primaryKey(),
  spaceId: integer('space_id')
    .notNull()
    .references(() => spaces.id)
    .unique(),

  published: boolean('published').notNull().default(false),
  publishedAt: timestamp('published_at'),
  summary: text('summary'),                    // card teaser, max 160
  coverImageUrl: text('cover_image_url'),

  goalAmount: numeric('goal_amount'),          // display-only v1
  goalCurrency: text('goal_currency'),         // ISO 4217

  blocks: jsonb('blocks').notNull().default([]),
  supportActions: jsonb('support_actions').notNull().default([]),

  ...commonDateFields,
});
```

### 8.2 Block schema

```typescript
type ImpactBlockType =
  | 'about'
  | 'mission'
  | 'needs'
  | 'useOfFunds'
  | 'whyNow'
  | 'gallery'
  | 'location'
  | 'links'
  | 'cta'
  | 'stories';

type ImpactBlock = {
  id: string;
  type: ImpactBlockType;
  order: number;
  visible: boolean;
  title?: string;
  body?: string;                 // markdown v1
  items?: ImpactBlockItem[];
  metadata?: Record<string, unknown>;
};

type ImpactBlockItem = {
  id: string;
  text?: string;
  imageUrl?: string;
  caption?: string;
  url?: string;
  label?: string;
};
```

---

## 9) API contract

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/spaces/{slug}/impact` | Public if published; members always | Full profile + Story signals |
| PUT | `/api/v1/spaces/{slug}/impact` | Member/delegate | Update blocks, CTAs, summary |
| PATCH | `/api/v1/spaces/{slug}/impact/publish` | Member/delegate | Toggle `published` with validation |
| GET | `/api/v1/network/opportunities` | Public | Paginated published profiles |

### 9.1 GET impact response (recommended)

```typescript
{
  found: boolean;
  space: { slug: string; title: string; logoUrl: string | null; leadImage: string | null; locationLabel: string | null };
  profile: {
    published: boolean;
    publishedAt: string | null;
    summary: string | null;
    coverImageUrl: string | null;
    goalAmount: string | null;
    goalCurrency: string | null;
    blocks: ImpactBlock[];
    supportActions: ImpactSupportAction[];
  } | null;
  stories: Array<{
    id: number;
    title: string;
    description: string;
    createdAt: string;
    eventDate: string | null;
    attachments: Array<{ url: string; caption?: string }>;
  }>;
  canEdit: boolean;
}
```

---

## 10) Implementation plan

### Phase A — Impact tab (MVP)

1. DB migration + schema export
2. Core queries/mutations in `packages/core/src/impact/server/`
3. API routes under `apps/web/src/app/api/v1/spaces/[spaceSlug]/impact/`
4. Route: `apps/web/src/app/[lang]/dho/[id]/@tab/impact/page.tsx`
5. Nav: first item in `packages/epics/src/common/ai-left-panel.tsx`
6. Components in `packages/epics/src/impact/`:
   - `ImpactPage` — public/member view
   - `ImpactBlockEditor` — inline `+`, reorder, gallery upload
   - `ImpactStoriesSection` — Story coherences timeline
   - `ImpactSupportBar` — CTA buttons
   - `ImpactPublishPanel` — opt-in toggle + validation
7. i18n: `ImpactTab` namespace (en, de, pt, es, fr, mk)

### Phase B — Story signal type

1. Add `Story` to `COHERENCE_SIGNAL_TYPES` + validation
2. “Add story” from Impact tab
3. Coherence tab filter includes Stories

### Phase C — Opportunities network

1. `GET /api/v1/network/opportunities`
2. `ExploreSpaces`: add `view=opportunities`
3. `OpportunityCard` component
4. Map popup enrichment for published spaces

### Phase D — Polish

- Share link + OG meta for impact page
- Optional governance proposal for publish (v2)
- Goal progress vs treasury balance (v2)

---

## 11) Ticket breakdown

| # | Ticket | Scope |
| --- | --- | --- |
| 1 | DB schema + CRUD API | `space_impact_profiles`, core server, REST routes |
| 2 | Impact tab read-only | Route, public page, member preview |
| 3 | Inline block editor | `+`, reorder, gallery upload, template |
| 4 | Story signal type | Coherence type, form, Impact stories section |
| 5 | Support CTAs | Treasury/banking integration |
| 6 | Publish toggle | Validation, permissions |
| 7 | Opportunities network | List/map/view + cards + API |
| 8 | i18n + OG meta | All locales, share previews |

---

## 12) Best practices

1. Lead with story, not numbers — About + achievements before the ask.
2. Specific use of funds — bulleted breakdown builds trust (myCause pattern).
3. Urgency with dignity — “Why now” without pressure tactics.
4. Visual proof — gallery + Story photos are essential.
5. Multiple support paths — Donate (small), bank transfer (large), Invest (structured).
6. Opt-in marketplace — spaces control public fundraising visibility.
7. Achievements as living content — Story signals keep the page fresh.
8. Mobile-first sticky CTAs.
9. Template on first visit — Homa Bay-style default sections.
10. Separate Impact from Overview — Overview = metrics; Impact = qualitative ask.

---

## 13) Example mapping (Homa Bay → Hypha blocks)

| myCause section | Hypha block |
| --- | --- |
| About the Cause | `about` |
| What's happened so far | `stories` + `about` continuation |
| How funds will be used | `useOfFunds` |
| Why we're asking now | `whyNow` |
| Thank you / invitation | `cta` |
| Donate button | `supportActions` → IBAN + wallet |
| Graduation photos | `gallery` + Story attachments |

---

## 14) Open decisions

| # | Decision | Recommendation |
| --- | --- | --- |
| 1 | Default landing tab | Keep overview as default URL; promote Impact as **first nav item** |
| 2 | Goal tracking | v1 display-only; v2 tie to treasury balance |
| 3 | Donation feed | Defer — privacy concerns |
| 4 | Rich text | Markdown v1 (matches documents pattern) |
| 5 | Governance gate for publish | Member toggle v1; optional proposal v2 |
| 6 | CTA default labels | i18n keys: `ImpactTab.actions.donate`, `.invest`, `.support` |

---

## 15) Related code references

| Area | Path |
| --- | --- |
| DHO tab pattern | `apps/web/src/app/[lang]/dho/[id]/@tab/overview/` |
| Nav source of truth | `packages/epics/src/common/ai-left-panel.tsx` |
| Network explore | `packages/epics/src/spaces/components/explore-spaces.tsx` |
| Space card | `packages/epics/src/spaces/components/space-card.tsx` |
| Coherence types | `packages/core/src/coherence/coherence-types.ts` |
| Transparency | `packages/epics/src/spaces/utils/transparency-access.ts` |
| Treasury deposit | `packages/epics/src/treasury/components/assets/assets-section.tsx` |
| IBAN display | `packages/epics/src/banking/components/deposit-instructions-card.tsx` |
| Space schema | `packages/storage-postgres/src/schema/space.ts` |
| Space configuration | `apps/web/src/app/[lang]/dho/[id]/@aside/[tab]/space-configuration/` |

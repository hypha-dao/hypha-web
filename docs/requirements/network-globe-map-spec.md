# Technical Specification — Network Globe Map

## Document control

| Field | Value |
| --- | --- |
| Status | Draft — ready for implementation |
| Scope | Interactive D3 globe on `/[lang]/network`, space geo pins, thematic layers, space configuration pin picker |
| Primary surfaces | Network explore (`ExploreSpaces`), Space configuration (`SpaceForm` / `space-configuration` aside) |
| Out of scope (v1) | 3D photorealistic terrain, real-time satellite tiles, commercial One Earth Navigator embed |

---

## 1) Problem statement

The [Hypha Network](https://app.hypha.earth/en/network) page lists ~566 spaces with category filters but no geographic context. Stakeholders want:

1. A **globe** that animates into a **planisphere** (flat world map), with **versor dragging** to rotate the whole world.
2. **Thematic layers** (bioregions, water, forest, culture-adjacent data, etc.) toggled independently from Hypha space category filters.
3. **Space pins** derived from configuration, set via search, address, click, or coordinates.
4. Optional **equal-area projection** so continent sizes reflect physical area (not Mercator distortion).

Today:

- `spaces.address` is the **Web3 executor address** (`web3_address`), not geography — see `packages/storage-postgres/src/schema/space.ts`.
- `d3` is already a dependency in `apps/web` and used for DHO bubble visualization (`space-visualization.tsx`).
- Network page loads all spaces server-side via `getAllSpaces` in `apps/web/src/app/[lang]/network/page.tsx`.

---

## 2) Integration options analysis

### Option 1 — One Earth ([oneearth.org](https://www.oneearth.org/))

| Aspect | Assessment |
| --- | --- |
| Public REST API | **No.** Navigator, Solutions Hub, and Finance Tracker are interactive web products, not documented HTTP APIs. |
| Data access | **Shapefile / GeoJSON by request.** [Bioregions dataset](https://www.oneearth.org/datasets/) requires form submission; license **CC BY-NC 4.0** (non-commercial without separate commercial license). |
| Bioregions framework | 185 bioregions, 844 ecoregions (built on RESOLVE 2017). Aligns with Hypha’s `bioregions` category and regenerative positioning. |
| Culture / water / forest layers | Not bundled as a single “layers API.” Culture is narrative content on the site, not a geospatial layer. Water/forest would come from **ecoregion attributes** or companion datasets (RESOLVE, Natural Earth), not One Earth alone. |
| Integration pattern | **Self-host converted GeoJSON/TopoJSON** in Hypha (or object storage), loaded by D3. Optional server **point-in-polygon** to tag spaces with `bioregion_id` on save. |
| Legal | NC license blocks default use on a commercial SaaS unless Hypha obtains a commercial license from One Earth. **Treat as Phase 2** after legal sign-off; use RESOLVE ecoregions (CC-friendly) for MVP layers. |

**Verdict:** Strategic alignment high; **no embeddable API**; data is downloadable with licensing constraints.

---

### Option 2 — Google Earth Web ([earth.google.com/web](https://earth.google.com/web/))

| Aspect | Assessment |
| --- | --- |
| Embeddable Earth Web app | **Not supported** for custom UX inside Hypha. |
| Programmatic path | **Google Maps JavaScript API** (`Map3DElement`, photorealistic 3D) or **Earth Engine** client library — separate products, API keys, billing, OAuth for EE. |
| Fit with D3 | **Poor.** Maps/EE use their own renderers; cannot combine orthographic→equirectangular transition and versor dragging with Hypha’s D3 globe in one canvas. |
| CSP | Requires `connect-src` / `script-src` allowlists for `maps.googleapis.com`, `*.googleapis.com` — see `apps/web/src/middleware.ts`. |
| Cost & ops | Per-request billing, key management, Google Cloud console. |

**Verdict:** Reject for core experience. Optional future “open in Google Earth” deep link only.

---

### Option 3 — Open-source geospatial stack (recommended base)

| Source | Use | License |
| --- | --- | --- |
| [Natural Earth](https://www.naturalearthdata.com/) | Coastlines, land, ocean, lakes, rivers | Public domain |
| [martynafford/natural-earth-geojson](https://github.com/martynafford/natural-earth-geojson) | Pre-built GeoJSON at 110m/50m/10m | Same |
| [RESOLVE Ecoregions 2017](https://developers.google.com/earth-engine/datasets/catalog/RESOLVE_ECOREGIONS_2017) | Forest/grassland/desert biomes, 844 regions | CC BY 4.0 |
| [One Earth Bioregions](https://www.oneearth.org/bioregions-2023/) (post-license) | 185 bioregions layer | CC BY-NC 4.0 |
| Hypha-hosted TopoJSON | Simplified boundaries for web performance | Derived |

**Geocoding (pin picker / search):**

| Provider | Pros | Cons |
| --- | --- | --- |
| **Nominatim (OSM)** via server proxy | Free, no client API key | Strict usage policy; rate limits; must cache |
| **Photon (Komoot)** | OSM-based, simpler API | Still third-party dependency |
| **Mapbox / Google** | Production SLAs | Paid; CSP + secrets |

**Verdict:** Build the visualization with **D3 + self-hosted TopoJSON/GeoJSON**. Add One Earth bioregions after license clarity.

---

## 3) Recommended selection

### Stack decision

| Layer | Choice | Rationale |
| --- | --- | --- |
| Renderer | **D3 v7** (`d3`, `d3-geo`; add `topojson-client` if using TopoJSON) | Already in monorepo; matches Observable references |
| Globe interaction | **Versor dragging** on `geoOrthographic` | [Observable: Versor dragging](https://observablehq.com/@d3/versor-dragging) |
| Globe → map transition | Interpolate **orthographic → equirectangular** (optionally via `geoStereographic` midpoint) | [Observable: Orthographic to Equirectangular](https://observablehq.com/@d3/orthographic-to-equirectangular) |
| Basemap vectors | Natural Earth 110m (network), 50m (pin picker detail) | Small bundle, public domain |
| Thematic layers (MVP) | RESOLVE ecoregions + Natural Earth water (lakes/rivers) | CC BY 4.0; maps to “forest/water/biodiversity” narratives |
| Thematic layers (v2) | One Earth bioregions | After NC/commercial license |
| True-size map | **`geoEqualEarth`** default toggle; optional `geoNaturalEarth1` | Recognizable, equal-area; avoids extreme Peters distortion |
| Space locations | **New DB columns** + server geocode API | `address` column is Web3 — do not overload |
| Geocoding | **Server route** `POST /api/v1/geocode` proxying Nominatim with cache | Keeps API keys off client; respects CSP |

### UX mode on Network page

- **Default view:** List + filters (current) with a **“Map” tab** or split hero toggle — do not remove list until map parity is proven.
- **Map view:** Full-width canvas (min height 480px mobile / 640px desktop), layer chips, projection toggle, same category/order/search query params as list where applicable.

---

## 4) UX specification

### 4.1 Network map view

**Entry:** `/[lang]/network?view=map` (preserve existing `query`, `category`, `order`).

**Layout (desktop):**

```text
┌─────────────────────────────────────────────────────────────┐
│  Many Spaces, One Network          [List] [Map]  Create...   │
├─────────────────────────────────────────────────────────────┤
│  Layer: [Bioregions] [Water] [Forest] ...   Proj: [Globe▼] │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              D3 canvas (globe / planisphere)           │  │
│  │         · space pins · hover tooltip · drag rotate      │  │
│  └───────────────────────────────────────────────────────┘  │
│  Category filters (existing chips) — filters **pins** only   │
├─────────────────────────────────────────────────────────────┤
│  Optional: collapsed list / selected space card on pin click  │
└─────────────────────────────────────────────────────────────┘
```

**Interactions:**

| Action | Behavior |
| --- | --- |
| Initial load | Render **orthographic** globe, auto-rotate slowly (optional, respect `prefers-reduced-motion`) |
| Double-click / “Expand map” control | Animate projection to **equirectangular** over ~1.2s (`d3.interpolate` on projection raw) |
| Drag on globe | Versor rotation (entire world moves as one) |
| Pin hover | Tooltip: space title, member count, categories |
| Pin click | Navigate to `/{lang}/dho/{slug}/overview` or open aside preview |
| Layer toggle | Show/hide GeoJSON layers; at most 2 heavy polygons active on mobile |
| Projection menu | `Globe` (orthographic) · `Flat` (equirectangular) · `True size` (equalEarth) |
| Reduced motion | Skip auto-rotate and use cross-fade instead of long projection tween |

**Accessibility:**

- Canvas: `role="img"` + `aria-label` summarizing visible region and pin count.
- Layer toggles: native `button` / Radix `ToggleGroup`, keyboard operable.
- Pin list alternative: screen-reader-only list of spaces with coordinates linked from map data.

### 4.2 Space configuration — location pin

**Surface:** `SpaceForm` when `label="configure"` (`space-configuration` aside).

**New section:** “Location on map” (below description or in a collapsible “Location” card).

| Control | Behavior |
| --- | --- |
| Search field | Debounced geocode; dropdown of results (label + lat/lng) |
| Address display | Read-only formatted label after selection |
| Coordinate inputs | Optional advanced: lat (−90…90), lng (−180…180) with validation |
| Mini-map | Equirectangular D3 (simpler than full globe); click to set pin; drag pin |
| Clear | Sets location fields to `null` |
| Privacy note | Short copy: approximate location (rounded to ~1 km) shown on public network map |

**Permissions:** Same as today for space configuration (authenticated member with configure rights).

**Validation:**

- If any of lat/lng/label provided, require lat **and** lng.
- Reject (0,0) unless explicitly confirmed (ocean null island guard).

---

## 5) Data model

### 5.1 New columns on `spaces`

```sql
-- migration: add_space_geo_location
latitude   double precision NULL,
longitude  double precision NULL,
location_label text NULL,          -- geocoded display name
location_source text NULL,         -- 'geocode' | 'manual' | 'map_click'
located_at timestamptz NULL,       -- last pin update
CONSTRAINT spaces_geo_coords_paired CHECK (
  (latitude IS NULL AND longitude IS NULL)
  OR (latitude IS NOT NULL AND longitude IS NOT NULL)
)
```

Public map responses round stored coordinates to **2 decimal places** (~1.1 km) before exposure; exact values remain in the database for space configuration.

- Additional bounds and enum checks: see migration `0053_space_geo_location.sql`.
- Index for map queries: `CREATE INDEX spaces_geo_idx ON spaces (latitude, longitude) WHERE latitude IS NOT NULL;`

### 5.2 API contract extensions

**`GET /api/v1/spaces`** (and network server loader):

- Include `latitude`, `longitude`, `locationLabel` when present.
- Add query `hasLocation=true` to filter mappable spaces only (map view default: show all, dim pins without location).

**`PATCH` / update space** (existing update path):

- Accept optional `latitude`, `longitude`, `locationLabel`, `locationSource`.

**`POST /api/v1/geocode`** (new, server-only):

```ts
// Request
{ query: string; limit?: number } // default limit 5

// Response
{
  results: Array<{
    label: string;
    latitude: number;
    longitude: number;
    placeId?: string;
  }>;
}

// Error responses
{
  error: {
    code:
      | 'VALIDATION_ERROR'
      | 'RATE_LIMIT_EXCEEDED'
      | 'GEOCODE_FAILED'
      | 'INTERNAL_ERROR';
    message: string;
    details?: unknown;
  };
}

// HTTP status codes:
// 400 - Invalid query parameter or malformed JSON body
// 429 - Rate limit exceeded
// 502 - Nominatim unavailable
// 500 - Internal server error
```

- Rate limit per IP/user.
- Cache results in Postgres (`geocode_cache` table: `query_hash`, `results` JSONB, `expires_at`) keyed by normalized query (24h TTL). Redis is deferred unless profiling shows cache latency issues.
- `User-Agent` and attribution per [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/).

**Optional `GET /api/v1/geo/layers/:layerId`:**

- Serve pre-simplified TopoJSON from `public/geo/` or blob storage with `Cache-Control: public, max-age=86400`.

### 5.3 Layer catalog (MVP)

| `layerId` | Source | Hypha alignment |
| --- | --- | --- |
| `land` | Natural Earth land 110m | Base |
| `water` | Natural Earth lakes + rivers | `water`, `ocean` categories |
| `ecoregions` | RESOLVE 2017 simplified | `biodiversity`, `land`, `forest` (derived biome) |
| `graticule` | D3 built-in | Orientation aid |

**v2 (post-license):** `bioregions` (One Earth 185).

**Not in v1:** “Culture” as polygon layer (no global culture GIS standard); use **space category** filter + pin color instead.

### 5.4 Category vs layer distinction

| Concept | Purpose |
| --- | --- |
| **Hypha `categories`** (existing JSON on space) | Filter **which pins** show; colors/icons on pins |
| **Map layers** | Background ecological polygons independent of space metadata |

---

## 6) Technical architecture

### 6.1 Package placement (monorepo boundaries)

```text
packages/epics/src/network-map/     # NetworkMap, LayerControls, PinLayer
packages/epics/src/spaces/          # SpaceLocationPicker (used by SpaceForm)
packages/core/src/geo/              # types, geocode client, layer metadata
apps/web/public/geo/                # static TopoJSON (versioned)
apps/web/src/app/api/v1/geocode/   # route handler
```

- Client components: `'use client'`.
- Do **not** import `./server` from map components; geocode only via API route.

### 6.2 D3 module structure

```ts
// packages/epics/src/network-map/lib/projection-controller.ts
type MapProjectionMode = 'globe' | 'flat' | 'equalEarth';

// Interpolate rotate + scale between orthographic and equirectangular
// Use d3.geoInterpolate for great-arc pin hover highlights (optional)
```

**Dependencies to add:**

| Package | Package target | Reason |
| --- | --- | --- |
| `topojson-client` | `packages/epics` or `apps/web` | Smaller layer payloads |
| `d3-geo` | Already part of `d3` v7 bundle | Projections |

**Performance:**

- Simplify polygons with `topojson.mesh` / precomputed 110m files (< 500KB per layer gzipped).
- Use `requestAnimationFrame` for drag; throttle redraw.
- Virtualize pin drawing: if > 300 pins, cluster with `d3.geoCluster` or grid binning on low zoom.

### 6.3 Feature flag

- `NEXT_PUBLIC_ENABLE_NETWORK_MAP` (build-time, default `false`).
- When off: hide Map tab; hide location section in SpaceForm.

### 6.4 CSP / env

- Static geo assets: `'self'` only (no CSP change).
- Geocode: add Nominatim host to `NEXT_PUBLIC_CONNECT_SOURCES` **or** keep all geocode server-side (preferred — no CSP change).
- If Mapbox added later: extend `connect-src` via env.

---

## 7) Implementation phases

### Phase 1 — Data + pin picker (1 sprint)

| ID | Task |
| --- | --- |
| P1-1 | DB migration + Drizzle schema + `Space` type updates |
| P1-2 | Extend `schemaUpdateSpace` / `updateSpaceById` with geo fields |
| P1-3 | `POST /api/v1/geocode` with caching + tests |
| P1-4 | `SpaceLocationPicker` in `SpaceForm` (configure only) |
| P1-5 | i18n keys (`NetworkMap`, `SpaceLocation`) all locales |
| P1-6 | Unit tests: validation, geocode normalizer |

### Phase 2 — Network map MVP (1–2 sprints)

| ID | Task |
| --- | --- |
| P2-1 | `NetworkGlobeMap` client component with versor drag |
| P2-2 | Orthographic → equirectangular animation |
| P2-3 | Load land + water layers; layer toggle UI |
| P2-4 | Plot pins from spaces with lat/lng; link to DHO |
| P2-5 | `?view=map` on network page + List/Map toggle |
| P2-6 | Wire category/search filters to pin subset |
| P2-7 | Feature flag + empty state (“No spaces with location yet”) |

### Phase 3 — Equal-area + ecoregions (1 sprint)

| ID | Task |
| --- | --- |
| P3-1 | Projection toggle: Equal Earth |
| P3-2 | RESOLVE ecoregions layer + legend |
| P3-3 | Biome-based pin coloring option (optional) |

### Phase 4 — One Earth + polish (post-legal)

| ID | Task |
| --- | --- |
| P4-1 | Commercial/license approval for Bioregions 2023 |
| P4-2 | Ingest bioregions TopoJSON; replace/augment ecoregions layer |
| P4-3 | Server bioregion lookup on space save |

---

## 8) Test plan (QA)

### 8.1 Automated

| Area | Test |
| --- | --- |
| Geocode API | Vitest: mock fetch, rate limit, empty results, invalid query |
| Validation | lat/lng bounds, paired nullability |
| E2E (flag on) | Playwright: open network map, toggle layer, click pin → DHO |
| E2E configure | Set location via search, save, reload form, values persist |
| a11y | axe on map controls; reduced-motion path |

### 8.2 Manual

- [ ] Globe drag smooth at 60fps on M1 laptop and mid-tier Android
- [ ] Projection animation completes without pin drift
- [ ] 566 pins: acceptable FPS or clustering kicks in
- [ ] CSP production: no console violations
- [ ] Space without location: excluded or dimmed per spec
- [ ] i18n: `pnpm verify:messages`

---

## 9) Acceptance criteria (INVEST)

1. **Given** a space admin in configuration, **when** they search an address and save, **then** lat/lng/label persist and appear on the network map after refresh.
2. **Given** the network map view, **when** the user drags the globe, **then** the world rotates as a rigid sphere (versor behavior).
3. **Given** the globe view, **when** the user triggers “Flat map”, **then** the projection animates to equirectangular within ≤ 1.5s (or instant if reduced motion).
4. **Given** layer toggles, **when** water layer is off, **then** rivers/lakes polygons are not rendered.
5. **Given** equal-area mode, **when** comparing Africa vs Greenland, **then** relative areas are materially more accurate than Web Mercator.
6. **Given** `NEXT_PUBLIC_ENABLE_NETWORK_MAP=false`, **then** no map UI is exposed.

---

## 10) Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| One Earth NC license | MVP without OE data; legal review before Phase 4 |
| Nominatim rate limits | Server cache + debounce; plan Mapbox fallback |
| Large GeoJSON bundle | TopoJSON 110m + lazy load per layer |
| Pin overlap at scale | Clustering + zoom-dependent labels |
| `address` naming confusion | New fields `latitude`/`longitude`; never reuse `web3_address` |
| Mobile WebGL/SVG perf | Cap active layers; simplify mesh on narrow viewports |

---

## 11) References

- [D3 — Orthographic to Equirectangular](https://observablehq.com/@d3/orthographic-to-equirectangular)
- [D3 — Versor dragging](https://observablehq.com/@d3/versor-dragging)
- [One Earth Bioregions](https://www.oneearth.org/bioregions-2023/)
- [One Earth datasets / license](https://www.oneearth.org/datasets/)
- [Natural Earth](https://www.naturalearthdata.com/)
- [Hypha Network (production)](https://app.hypha.earth/en/network)

---

## 12) Open questions for product sign-off

1. Should map view **replace** list as default or remain secondary tab?
2. Is displaying spaces without coordinates as a **“Set location”** CTA in space settings acceptable for onboarding?
3. Is **One Earth commercial license** in budget for bioregions authenticity?

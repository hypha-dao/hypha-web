# DHO **Wiki** tab — product note

| Field      | Value                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Status** | Route + nav ship in app; rich media and mixed content is a **separate** engineering task (same org / space memory APIs) |

## Intent

- **Wiki** is the home for **space memory** in the DHO left rail: images, audio, video, and **call transcripts** and related artifacts, backed by the **existing** space memory / org-memory client stack (`SpaceMemorySection` today).
- **This change** only: **renames** the nav from “Artifact” to **Wiki**, route **`/wiki`**, and **redirects** legacy **`/artifact` → `/wiki`**. It does **not** add new storage, APIs, or media-type-specific UI beyond what `SpaceMemorySection` already shows.
- **Follow-up task:** dedicated UX for **typed** media (galleries, players, transcript readers) and any API extensions — **separate** PR.

## i18n

- Nav: `Common.Wiki` (and `CoherenceTab.wiki` for standalone `SpaceMemorySection` title when `standalonePage`).

## QA

- With `getEnableSpaceMemory()`: left rail shows **Wiki**, URL matches `/[lang]/dho/[id]/wiki`, `aria-current` on active.
- `GET` `/…/artifact` (old bookmark) **308/redirect** to `/…/wiki`.

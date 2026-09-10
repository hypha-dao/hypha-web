# Language Select in Menu Bar

**Date:** 2026-03-09
**Status:** Draft
**Author:** Product Owner

---

## Problem Statement

Users have no way to change the application language through the UI. The locale is currently determined solely by browser `Accept-Language` header detection and the URL prefix (`/en/...`, `/de/...`). There is no visible control to override or switch this, which means users who prefer a different language than their browser default — or who want to explore the app in another language — are stuck.

## Goal

Provide a discoverable, accessible language selector in the top menu bar so users can explicitly choose their preferred locale. The selection must persist across sessions and integrate with the existing `next-i18n-router` infrastructure and `[lang]` route prefix.

---

## Current State

| Aspect                                | Status                                                    |
| ------------------------------------- | --------------------------------------------------------- |
| i18n package (`@hypha-platform/i18n`) | Exists — config, middleware, dictionary loader            |
| Supported locales                     | `en` (English), `de` (German)                             |
| Locale routing                        | Path-prefix via `[lang]` dynamic segment                  |
| Locale persistence                    | `HYPHA_LOCALE` cookie (set by middleware)                 |
| Dictionary content                    | 6 keys per locale — not yet consumed by components        |
| Language selector UI                  | **Does not exist**                                        |
| Menu bar component                    | `packages/ui/src/organisms/menu-top.tsx`                  |
| Nav items rendered in                 | `packages/epics/src/people/components/button-profile.tsx` |

---

## Requirements

### R1 — Language Select Component

- **R1.1** A language select control must be visible in the top menu bar (`MenuTop`) on all pages.
- **R1.2** The control must display the currently active locale (at minimum the locale code, e.g. "EN" / "DE"; a flag icon or language name label is acceptable as an enhancement).
- **R1.3** Activating the control must reveal all available locales as defined in `i18nConfig.locales`.
- **R1.4** The control must be usable on both desktop and mobile viewports. On mobile, it should be accessible within the mobile menu overlay or remain visible in the header bar — whichever is more consistent with the existing mobile navigation pattern.

### R2 — Locale Switching Behaviour

- **R2.1** Selecting a different locale must navigate the user to the equivalent page under the new locale prefix (e.g. `/en/network` to `/de/network`). The current route and any query parameters must be preserved.
- **R2.2** The `HYPHA_LOCALE` cookie must be updated to reflect the user's selection so that subsequent visits default to the chosen locale.
- **R2.3** The page must not perform a full reload if avoidable; prefer client-side navigation via `next/navigation` (`useRouter`).
- **R2.4** If dictionary translations are not yet available for a UI string in the target locale, the app must fall back to the `defaultLocale` (`en`) string without crashing or showing empty text.

### R3 — Persistence & Defaults

- **R3.1** On first visit (no cookie), the middleware must continue to resolve the locale from the browser `Accept-Language` header (existing behaviour — no change).
- **R3.2** Once the user explicitly selects a locale via the selector, that choice (cookie) takes precedence over `Accept-Language` on all subsequent requests.
- **R3.3** The selected locale must persist across browser sessions (cookie expiry should be at least 1 year).

### R4 — Design & UX

- **R4.1** The selector must follow the existing design system (shadcn/ui components, Tailwind CSS v4 tokens, Radix primitives).
- **R4.2** Placement: on desktop, the selector should appear in the right section of the menu bar, near the theme toggle and profile avatar. On mobile, within the mobile overlay menu or persistently in the header.
- **R4.3** The selector should be compact — a dropdown or popover trigger, not a full row of buttons — to avoid crowding the menu bar as more locales are added in the future.
- **R4.4** The selector must meet WCAG 2.1 AA accessibility: keyboard navigable, proper `aria-label`, focus management, and sufficient colour contrast.

### R5 — Extensibility

- **R5.1** Adding a new locale in the future must require only: (a) adding the locale code to `i18nConfig.locales`, (b) providing a dictionary JSON file, and (c) no changes to the selector component itself.
- **R5.2** Locale display metadata (label, optional icon/flag) should be defined in a single configuration source, not hardcoded in the component.

---

## Out of Scope

- Translating all existing UI strings (this is a separate effort; the selector should work even while most strings are still English-only).
- Adding locales beyond `en` and `de` (the selector must support it, but onboarding new locales is a separate task).
- User-account-level locale preference stored server-side (cookie-based persistence is sufficient for now).
- Right-to-left (RTL) layout support.

---

## Acceptance Criteria

1. A language selector is visible in the `MenuTop` header on every page (desktop and mobile).
2. Clicking the selector shows `en` and `de` as options (sourced from config, not hardcoded in UI).
3. Selecting a locale navigates to the correct `[lang]` route without full page reload.
4. The `HYPHA_LOCALE` cookie is set and persists the choice for at least 1 year.
5. Refreshing the page or opening a new tab defaults to the previously selected locale.
6. The component is keyboard-accessible and screen-reader friendly.
7. No changes to the selector component are needed when a third locale is added to `i18nConfig.locales` + dictionary.

---

## Technical Notes

- The `MenuTop` component (`packages/ui/src/organisms/menu-top.tsx`) accepts `children`; the selector can be composed as a child alongside `ConnectedButtonProfile` in the root layout (`apps/web/src/app/layout.tsx:113-130`).
- The existing `@hypha-platform/cookie` package already exports `HYPHA_LOCALE` and provides cookie utilities.
- `next-i18n-router` handles redirect logic in middleware (`apps/web/src/middleware.ts`); the cookie value it reads is `HYPHA_LOCALE`.
- Consider using the shadcn `DropdownMenu` or `Select` primitive, consistent with the profile dropdown already in use.

---

## References

- `packages/i18n/src/i18n-config.ts` — locale config
- `packages/ui/src/organisms/menu-top.tsx` — menu bar component
- `packages/epics/src/people/components/button-profile.tsx` — nav items & profile dropdown
- `apps/web/src/app/layout.tsx` — root layout where MenuTop is composed
- `apps/web/src/middleware.ts` — middleware chain (i18n + CSP)
- `agents/_library/competencies/i18n-engineering.md` — i18n architecture reference
- `agents/_library/best-practices/i18n.md` — i18n guidelines

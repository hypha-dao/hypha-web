# Language Select in Menu Bar — Lead Engineer Requirements

**Date:** 2026-03-09
**Status:** Draft
**Author:** Lead Engineer
**Depends on:** `requirements.product-owner.md`

---

## Architecture Overview

This feature adds a client-side locale switcher to the existing `MenuTop` header. The implementation spans three packages and the web app, following the established dependency direction: `i18n -> ui -> epics -> apps/web`.

### Component Placement in the Render Tree

```
RootLayout (apps/web/src/app/layout.tsx)
  └─ MenuTop (packages/ui)
       └─ children:
            ├─ LanguageSelect          ← NEW (packages/ui — presentational)
            └─ ConnectedButtonProfile  (packages/epics — connected)
```

The `LanguageSelect` is a **presentational UI component** that lives in `packages/ui`. It is composed into `MenuTop` alongside `ConnectedButtonProfile` in the root layout.

---

## Implementation Plan

### Step 1 — Add locale metadata to `@hypha-platform/i18n`

**File:** `packages/i18n/src/locale-metadata.ts` (new)

Create a single-source-of-truth map for locale display data. This satisfies R5.2 (no hardcoded labels in the component).

```ts
import type { Locale } from './i18n-config';

export type LocaleMetadata = {
  code: Locale;
  label: string; // e.g. "English", "Deutsch"
  shortLabel: string; // e.g. "EN", "DE"
};

export const localeMetadata: Record<Locale, LocaleMetadata> = {
  en: { code: 'en', label: 'English', shortLabel: 'EN' },
  de: { code: 'de', label: 'Deutsch', shortLabel: 'DE' },
};
```

**Export from the client entry point** (`packages/i18n/src/client.ts`):

```ts
export * from './i18n-config';
export * from './locale-metadata';
```

This is critical — the metadata must be importable from `@hypha-platform/i18n/client` since it will be consumed by a `'use client'` component. Do **not** export it from the server-only root entry.

**Extensibility constraint (R5.1):** When a new locale is added in the future, the developer adds an entry to both `i18nConfig.locales` and `localeMetadata`. The component itself requires zero changes.

---

### Step 2 — Create the `LanguageSelect` component in `packages/ui`

**File:** `packages/ui/src/language-select.tsx` (new)

This is a **presentational, client-side** component (`'use client'`).

#### Props Interface

```ts
type LanguageSelectProps = {
  currentLocale: string;
  locales: Array<{
    code: string;
    label: string;
    shortLabel: string;
  }>;
  onLocaleChange: (locale: string) => void;
};
```

The component receives all data via props. It does **not** import from `@hypha-platform/i18n` directly — the consuming layer provides the config. This keeps the dependency graph clean (`ui` should not depend on `i18n`).

#### Implementation Constraints

1. **Use `DropdownMenu` with `DropdownMenuRadioGroup`** — this is the established pattern in the codebase (see the profile dropdown in `button-profile.tsx`). The `DropdownMenuRadioItem` provides a built-in check indicator for the active locale.

2. **Trigger element:** A `Button` with `variant="ghost"` and `size="icon"`, displaying a `Globe` icon from `lucide-react` (already a project dependency). The current locale short label (e.g. "EN") should be shown alongside or below the icon. Use `aria-label="Select language"`.

3. **Desktop rendering:** The dropdown renders inline in the `#menu-top-actions` flex container.

4. **Mobile rendering:** The component must work within the mobile fullscreen overlay that `MenuTop` renders. Since `MenuTop` renders `{children}` identically in both desktop (`hidden md:flex`) and mobile (`flex flex-col`) containers, the `LanguageSelect` will naturally appear in both. However, consider that on mobile the dropdown trigger should still open a `DropdownMenu` (not a different interaction) — verify this works correctly within the fixed overlay (`z-40`). The dropdown portal renders at `z-50`, which stacks above the overlay.

5. **Accessibility (R4.4):**

   - The trigger must have `aria-label="Select language"`
   - Each `DropdownMenuRadioItem` must use the full locale label as its accessible name (e.g. "English", not "EN")
   - Keyboard navigation is handled by Radix out of the box — do not override
   - Ensure the trigger has visible focus styles (the ghost button variant already provides this)

6. **Export from `packages/ui`:** Add to `packages/ui/src/index.ts`:
   ```ts
   export { LanguageSelect } from './language-select';
   ```

---

### Step 3 — Compose in the root layout

**File:** `apps/web/src/app/layout.tsx`

Update the `MenuTop` children to include `LanguageSelect` **before** `ConnectedButtonProfile`:

```tsx
import { MenuTop, LanguageSelect } from '@hypha-platform/ui';
import { i18nConfig } from '@hypha-platform/i18n';
import { localeMetadata } from '@hypha-platform/i18n/client';

// Inside RootLayout:
const locales = i18nConfig.locales.map((code) => localeMetadata[code]);

<MenuTop logoHref={ROOT_URL}>
  <LanguageSelect
    currentLocale={lang}
    locales={locales}
    onLocaleChange={???}  // see Step 4
  />
  <ConnectedButtonProfile ... />
</MenuTop>
```

**Problem:** The root layout is a **Server Component**. The `onLocaleChange` callback requires client-side logic (router navigation + cookie). You cannot pass a function from a Server Component to a Client Component as a prop.

**Solution:** Create a thin connected wrapper in `apps/web` (not in `packages/epics` — this is app-level wiring, not reusable epic logic):

**File:** `apps/web/src/components/connected-language-select.tsx` (new)

```tsx
'use client';

import { useRouter, usePathname, useParams } from 'next/navigation';
import { LanguageSelect } from '@hypha-platform/ui';
import { i18nConfig } from '@hypha-platform/i18n/client';
import { localeMetadata } from '@hypha-platform/i18n/client';
import { setCookie } from '@hypha-platform/cookie';
import { HYPHA_LOCALE } from '@hypha-platform/cookie';

export function ConnectedLanguageSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const { lang } = useParams<{ lang: string }>();

  const currentLocale = lang ?? i18nConfig.defaultLocale;

  const locales = i18nConfig.locales.map((code) => localeMetadata[code]);

  const handleLocaleChange = (newLocale: string) => {
    if (newLocale === currentLocale) return;

    // Update cookie with 1-year expiry (R3.2, R3.3)
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    setCookie(HYPHA_LOCALE, newLocale, expires);

    // Replace the locale prefix in the current path (R2.1)
    const newPathname = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  return <LanguageSelect currentLocale={currentLocale} locales={locales} onLocaleChange={handleLocaleChange} />;
}
```

Then in the root layout:

```tsx
import { ConnectedLanguageSelect } from '@web/components/connected-language-select';

<MenuTop logoHref={ROOT_URL}>
  <ConnectedLanguageSelect />
  <ConnectedButtonProfile ... />
</MenuTop>
```

This eliminates the need to pass `lang` from the server to the language selector — the connected component reads it from `useParams()`, matching the pattern used by `ConnectedButtonProfile`.

---

### Step 4 — Fix `<html lang>` attribute

**File:** `packages/ui/src/layouts/html.tsx`

The `<html lang="en">` is currently hardcoded. This is an accessibility and SEO issue (the `lang` attribute tells browsers and screen readers what language the content is in).

**Change:** Make `lang` a required prop:

```tsx
export const Html: React.FC<{
  children: React.ReactNode;
  className?: string;
  lang?: string;
}> = ({ children, className, lang = 'en' }) => {
  return (
    <html lang={lang} suppressHydrationWarning className={className}>
      ...
    </html>
  );
};
```

Update the root layout to pass `lang`:

```tsx
<Html lang={lang} className={clsx(lato.variable, sourceSans.variable)}>
```

This is a small fix that should be included in this PR since we're already touching the layout.

---

## File Change Summary

| File                                                    | Action                                                               | Package                |
| ------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------- |
| `packages/i18n/src/locale-metadata.ts`                  | **Create**                                                           | `@hypha-platform/i18n` |
| `packages/i18n/src/client.ts`                           | **Edit** — add `locale-metadata` export                              | `@hypha-platform/i18n` |
| `packages/ui/src/language-select.tsx`                   | **Create**                                                           | `@hypha-platform/ui`   |
| `packages/ui/src/index.ts`                              | **Edit** — add `LanguageSelect` export                               | `@hypha-platform/ui`   |
| `packages/ui/src/layouts/html.tsx`                      | **Edit** — make `lang` prop dynamic                                  | `@hypha-platform/ui`   |
| `apps/web/src/components/connected-language-select.tsx` | **Create**                                                           | `apps/web`             |
| `apps/web/src/app/layout.tsx`                           | **Edit** — compose `ConnectedLanguageSelect` + pass `lang` to `Html` | `apps/web`             |

---

## Technical Constraints

### Dependency Direction

```
@hypha-platform/cookie  (constants + client utils)
        ↓
@hypha-platform/i18n    (config + locale-metadata — client entry)
        ↓
@hypha-platform/ui      (LanguageSelect — presentational only)
        ↓
apps/web                (ConnectedLanguageSelect — wiring)
```

The `LanguageSelect` component in `packages/ui` must **not** import from `@hypha-platform/i18n`. All locale data is passed via props. The `ConnectedLanguageSelect` in `apps/web` bridges the two.

### Server/Client Boundary

- `packages/i18n` root export (`.`) includes `server-only` code (`get-dictionaries.ts`). Never import from `@hypha-platform/i18n` in a `'use client'` file.
- `packages/i18n/client` export (`./client`) is safe for client components. The new `locale-metadata.ts` is added here.
- `LanguageSelect` is `'use client'`.
- `ConnectedLanguageSelect` is `'use client'`.
- The root layout remains a Server Component. It imports `ConnectedLanguageSelect` as a Client Component boundary.

### Cookie Handling

- Use `setCookie` from `@hypha-platform/cookie` (client-side `document.cookie`).
- The cookie name is `HYPHA_LOCALE` from `@hypha-platform/cookie`.
- Set `Path=/` and expiry of 1 year (R3.3).
- **Verify** the existing `setCookie` always sets `Path=/`. Current implementation in `packages/cookie/src/util.ts:17` only appends `Path=/` when `expires` is provided. This is a latent bug — if called without `expires`, the cookie gets the current path scope. Consider always including `Path=/` regardless of expiry. Flag this to the implementing engineer.

### Navigation Behaviour

- `router.push()` from `next/navigation` performs client-side navigation (R2.3 — no full reload).
- The `pathname` from `usePathname()` returns the full path including the locale prefix (e.g. `/en/network`).
- The locale replacement `pathname.replace(\`/${currentLocale}\`, \`/${newLocale}\`)`is safe because`prefixDefault: true`guarantees every path starts with`/<locale>/`.
- **Edge case:** If `pathname` contains the locale string elsewhere (e.g. a slug like `/en/dho/en-dao`), the simple `.replace()` would corrupt it. Use a more targeted replacement: `'/' + newLocale + pathname.slice(currentLocale.length + 1)`. This replaces only the leading segment.

### Mobile Menu Integration

The `MenuTop` component renders `{children}` in both:

- Desktop: `<div className="hidden md:flex gap-2">{children}</div>`
- Mobile: `<div className="flex flex-col space-y-8 items-center">{children}</div>`

The `LanguageSelect` appears as a sibling to `ConnectedButtonProfile` in both contexts. On mobile, it will render vertically in the overlay. The dropdown portal (`z-50`) stacks above the overlay (`z-40`), so the popover positioning should work. **Test this specifically** — Radix portals in fixed overlays can sometimes have positioning issues.

---

## Acceptance Verification Checklist

Map back to the product owner's acceptance criteria:

| #   | Criterion                                               | How to Verify                                                                                                   |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| AC1 | Selector visible in header on every page                | Navigate to `/en/network`, `/de/dho/{id}`, etc. — globe icon visible in menu bar                                |
| AC2 | Shows `en` and `de` from config                         | Open dropdown — two radio items, labels from `localeMetadata`                                                   |
| AC3 | Navigates to correct `[lang]` route without full reload | Select "DE" on `/en/network` → URL becomes `/de/network`, no white flash / full page load                       |
| AC4 | `HYPHA_LOCALE` cookie set, 1-year expiry                | DevTools → Application → Cookies → verify `HYPHA_LOCALE=de`, expires ~2027                                      |
| AC5 | Refresh / new tab defaults to selected locale           | After selecting "DE", open new tab → lands on `/de/...`                                                         |
| AC6 | Keyboard accessible, screen-reader friendly             | Tab to trigger, Enter to open, Arrow keys to navigate, Enter to select. VoiceOver announces "Select language"   |
| AC7 | No component changes needed for third locale            | Add `'es'` to `i18nConfig.locales`, add metadata entry, add `es.json` dictionary — selector shows three options |

---

## Out of Scope (Confirming)

- Translating existing hardcoded UI strings (e.g. "Network", "My Spaces", "Logout" in `ButtonProfile`). That is a separate i18n adoption task.
- RTL support.
- Server-side user preference storage.
- Storybook story for `LanguageSelect` (nice-to-have, not blocking).

---

## Risks & Mitigations

| Risk                                                               | Impact                                            | Mitigation                                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setCookie` without `Path=/` scopes cookie to current path         | Locale only persists on the page where it was set | Fix `setCookie` to always include `Path=/`, or explicitly pass `expires` (which triggers `Path=/` in current impl)                                |
| Radix dropdown inside mobile overlay has positioning issues        | Dropdown appears off-screen or behind overlay     | Test on mobile viewport; if broken, consider using `DropdownMenuContent side="bottom" align="center"` or rendering a different mobile-specific UI |
| Naive `pathname.replace()` corrupts paths containing locale string | Navigation breaks on specific routes              | Use leading-segment-only replacement: `'/' + newLocale + pathname.slice(currentLocale.length + 1)`                                                |
| `next-i18n-router` middleware re-redirects after client-side nav   | Double navigation or flicker                      | The middleware only runs on initial server requests, not client-side transitions. Verify with `router.push()` that no server round-trip occurs    |

---

## References

- `packages/ui/src/organisms/menu-top.tsx` — menu bar, lines 36-38 (desktop children), 57-61 (mobile children)
- `packages/ui/src/dropdown-menu.tsx` — Radix dropdown primitives including `DropdownMenuRadioGroup` (line 19)
- `packages/epics/src/people/components/button-profile.tsx` — existing dropdown pattern (lines 137-229)
- `packages/epics/src/people/components/button-profile.connected.tsx` — `useParams()` pattern for reading `lang` (line 48)
- `packages/i18n/src/i18n-config.ts` — locale config
- `packages/i18n/src/client.ts` — client-safe export entry
- `packages/cookie/src/util.ts` — `setCookie` implementation (note `Path=/` issue at line 17)
- `packages/ui/src/layouts/html.tsx` — hardcoded `lang="en"` at line 6
- `apps/web/src/app/layout.tsx` — root layout composition (lines 113-130)

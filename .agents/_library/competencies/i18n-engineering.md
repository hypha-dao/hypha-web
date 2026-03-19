### Internationalization Engineering

#### i18n Architecture

- **Package:** `@hypha-platform/i18n` — centralized i18n logic for the monorepo
- **Library:** `next-intl` v4 — replaced `next-i18n-router`, `@formatjs/intl-localematcher`, and `negotiator`
- **Routing:** `defineRouting()` with prefix-based locale segments (`/en/...`, `/de/...`)
- **Middleware:** `createMiddleware(routing)` from `next-intl` — runs first in `apps/web/src/middleware.ts`
- **Cookie:** `NEXT_LOCALE` — set by `next-intl` middleware, read on subsequent requests
- **Messages:** Namespaced JSON files per locale in `packages/i18n/src/messages/` (`en.json`, `de.json`)
- **Server:** `getTranslations('Namespace')` from `next-intl/server` for RSCs
- **Client:** `useTranslations('Namespace')` from `next-intl` for client components

#### Package Exports

| Export          | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `"."`           | Server entry: `Locale` type, `locales`, `defaultLocale`, `localeMetadata` |
| `"./client"`    | Client entry: same without `server-only` side effects                     |
| `"./request"`   | `getRequestConfig()` for `next-intl`'s plugin (used in `next.config.ts`) |
| `"./routing"`   | `defineRouting()` config, exports `routing` and `Locale` type             |
| `"./navigation"`| `createNavigation(routing)`: `Link`, `useRouter`, `usePathname`, `redirect`, `getPathname` |

#### Current Locale Configuration

```typescript
export const routing = defineRouting({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
```

#### Message Structure

Messages are organized by namespace (PascalCase) with camelCase keys:

```json
{
  "Common": { "back": "Back", "home": "Home" },
  "Navigation": { "network": "Network" },
  "Spaces": { "createSpace": "Create Space" }
}
```

ICU message format for dynamic values: `"trialBannerTitle": "Only {daysLeft} days left"`

#### Integration Points

| Consumer                 | What it uses                          | How                                                    |
| ------------------------ | ------------------------------------- | ------------------------------------------------------ |
| `apps/web` middleware    | `middleware` from `@hypha-platform/i18n` | Runs first, sets `X-NEXT-INTL-LOCALE` header        |
| `apps/web` root layout  | `getLocale()`, `getMessages()`        | Wraps children in `<NextIntlClientProvider>`           |
| `apps/web` pages/layouts | `getTranslations`, `Locale` type     | Types `params.lang` in `[lang]` segment pages          |
| `packages/epics`         | `useTranslations`, `Locale` type     | Client components consume translations directly        |

#### Route Structure

All locale-aware routes live under `app/[lang]/`:

```
app/[lang]/
  network/              — Explore all spaces
  my-spaces/            — Authenticated user's spaces
  profile/              — Person profiles
  dho/[id]/             — Space detail with parallel routes (@aside, @tab)
```

Note: `[lang]` (not `[locale]`) — `next-intl` resolves locale from URL path prefix via middleware, not folder name.

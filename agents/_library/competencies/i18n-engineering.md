### Internationalization Engineering

#### i18n Architecture

- **Package:** `@hypha-platform/i18n` — centralized i18n logic for the monorepo
- **Exports:** `"."` (server: config, middleware, getDictionary), `"./client"` (client: config only)
- **Routing:** `next-i18n-router` with prefix-based locale segments (`/en/...`, `/de/...`)
- **Middleware:** `i18nRouter` composed in `apps/web` middleware chain alongside CSP
- **Cookie:** `HYPHA_LOCALE` from `@hypha-platform/cookie` — written by middleware, read by root layout
- **Dictionaries:** Flat JSON files per locale (`en.json`, `de.json`) with dynamic `import()` loading
- **Server-only:** `getDictionary` uses `'server-only'` — translations resolve in React Server Components

#### Current Locale Configuration

```typescript
const i18nConfig = {
  defaultLocale: 'en',
  locales: ['en', 'de'],
  prefixDefault: true,
  localeCookie: HYPHA_LOCALE,
} as const;

type Locale = 'en' | 'de';
```

#### Integration Points

| Consumer                 | What it uses                 | How                                                                       |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------- |
| `apps/web` middleware    | `middleware` function        | Composed via `composeMiddleware` chain                                    |
| `apps/web` root layout   | `i18nConfig`, `HYPHA_LOCALE` | Reads cookie for nav URL construction                                     |
| `apps/web` next.config   | `i18nConfig`                 | Redirects: `/` -> `/en/network`, `/:lang` -> `/:lang/network`             |
| `apps/web` pages/layouts | `Locale` type                | Types `params.lang` in `[lang]` segment pages                             |
| `packages/epics`         | `Locale` type                | Props typing across 23+ components (spaces, people, governance, treasury) |

#### Dictionary System

- **Format:** Flat key-value JSON — keys are English source strings, values are translations
- **Loading:** Async `import()` per locale — code-split, loaded on demand
- **Lookup function:** `getDictionary(locale)` returns `(key) => translatedString | key` (fallback to key)
- **Status:** Exported and available but not yet consumed outside the i18n package

#### Route Structure

All locale-aware routes live under `app/[lang]/`:

```
app/[lang]/
  network/              — Explore all spaces
  my-spaces/            — Authenticated user's spaces
  profile/              — Person profiles
  dho/[id]/             — Space detail with parallel routes (@aside, @tab)
    @tab/overview|agreements|members|treasury/
    @aside/agreements/create/...
```

#### Technology Stack

| Technology               | Role                                           |
| ------------------------ | ---------------------------------------------- |
| `next-i18n-router`       | Locale detection, redirect, cookie persistence |
| Next.js `[lang]` segment | URL-based locale routing                       |
| `server-only`            | Prevents dictionary loading in client bundles  |
| Dynamic `import()`       | Code-split dictionary loading per locale       |
| `@hypha-platform/cookie` | Shared cookie name constants                   |

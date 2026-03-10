---
name: i18n-translate
description: Create and manage translations for hypha-web using next-intl. Use when translating components, adding new translation keys, adding new locales, or working with i18n in this project.
---

# i18n Translation

Translate UI components in hypha-web using the `next-intl` library with the patterns established on `feat/agentic-i18n-ui-ux-impl-v2`.

## Architecture

- **Library:** `next-intl` (NOT the old dictionary-based i18n)
- **Message files:** `packages/i18n/src/messages/{locale}.json` (e.g., `en.json`, `de.json`)
- **Routing config:** `packages/i18n/src/routing.ts` — defines available locales
- **Locale metadata:** `packages/i18n/src/locale-metadata.ts` — display labels per locale
- **Supported locales:** Currently `en` and `de`

## Message File Structure

Messages are organized by namespace (PascalCase). Each namespace groups related keys:

```json
{
  "Common": { "back": "Back", "home": "Home" },
  "Navigation": { "network": "Network", "mySpaces": "My Spaces" },
  "Spaces": { "createSpace": "Create Space" },
  "Network": { "findASpace": "Find a Space" }
}
```

Keys use camelCase. Interpolation uses `{variable}` syntax: `"createdOn": "Created on {date}"`.

## Translating Components

### Client Components

```tsx
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('Spaces');
  return <h1>{t('createSpace')}</h1>;
}
```

For multiple namespaces, use multiple hooks:

```tsx
const tSpaces = useTranslations('Spaces');
const tCommon = useTranslations('Common');
```

### Server Components

```tsx
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('Spaces');
  return <h1>{t('createSpace')}</h1>;
}
```

### Interpolation

```tsx
t('createdOn', { date: formattedDate })
t('otherMembers', { count: 5 })
```

## Step-by-Step: Translate a Component

1. Identify all hardcoded strings in the component
2. Choose or create the appropriate namespace (check existing namespaces in `en.json` first)
3. Add keys to **all** locale files (`en.json`, `de.json`, etc.) — keys must match across files
4. Import the correct hook (`useTranslations` for client, `getTranslations` for server)
5. Replace hardcoded strings with `t('keyName')`
6. For strings with dynamic values, use interpolation: `t('key', { var: value })`

## Adding a New Locale

Read `references/add-locale.md` for instructions on adding a new language.

## Conventions

- Never add a key to one locale file without adding it to all others
- Keep namespaces consistent — reuse existing ones before creating new ones
- Use `Common` namespace for shared UI terms (Back, Home, Members, etc.)
- Namespace names are PascalCase, key names are camelCase
- The `NextIntlClientProvider` is already wired in the root layout
- Do NOT use the old dictionary-based system (`get-dictionaries.ts`, `i18n-config.ts`)

## Reference

- `references/add-locale.md` — Adding a new language
- `references/current-namespaces.md` — Full list of existing namespaces and keys

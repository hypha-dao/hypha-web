# Adding a New Locale

## Steps

1. **Create message file:** Copy `packages/i18n/src/messages/en.json` to `packages/i18n/src/messages/{locale}.json` and translate all values.

2. **Update routing:** Add the locale code to `packages/i18n/src/routing.ts`:

```ts
export const routing = defineRouting({
  locales: ['en', 'de', 'NEW_LOCALE'],
  defaultLocale: 'en',
  localePrefix: 'always',
});
```

3. **Update locale metadata:** Add entry in `packages/i18n/src/locale-metadata.ts`:

```ts
export const localeMetadata: Record<Locale, LocaleMetadata> = {
  en: { code: 'en', label: 'English', shortLabel: 'EN' },
  de: { code: 'de', label: 'Deutsch', shortLabel: 'DE' },
  NEW_LOCALE: { code: 'NEW_LOCALE', label: 'Language Name', shortLabel: 'XX' },
};
```

4. **Verify:** The `request.ts` file dynamically imports `messages/{locale}.json`, so no changes needed there. The middleware and navigation also derive from routing config automatically.

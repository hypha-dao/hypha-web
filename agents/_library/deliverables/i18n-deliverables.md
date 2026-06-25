### i18n Deliverables

| Artifact                  | Description                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **Dictionary Entries**    | Key-value pairs added to all locale JSON files (`en.json`, `de.json`) with correct translations |
| **Locale Configuration**  | Updates to `i18nConfig` when adding locales, changing defaults, or adjusting routing behavior   |
| **Middleware Updates**    | Changes to the i18n middleware or its composition in the `apps/web` middleware chain            |
| **Type Updates**          | `Locale` type updates propagated to all consuming packages (`epics`, `apps/web`)                |
| **Route Integration**     | New `[lang]` segment pages with proper `Locale`-typed params and dictionary consumption         |
| **Dictionary Validation** | Verification that all locale files share identical key sets with no missing entries             |
| **Migration Guide**       | Documentation when adding new locales or restructuring the dictionary format                    |
| **Locale Testing**        | Verification of routing redirects, cookie behavior, and dictionary loading per locale           |

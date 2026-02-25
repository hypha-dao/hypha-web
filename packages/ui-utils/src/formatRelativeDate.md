# formatRelativeDate Utility

A utility function for formatting dates as relative time strings (e.g., "5 minutes ago", "3 hours ago").

## Installation

This utility is part of the `@hypha-platform/ui-utils` package. Make sure you have it installed:

```bash
npm install @hypha-platform/ui-utils
```

## Usage

### Basic Usage

```typescript
import { formatRelativeDate } from '@hypha-platform/ui-utils';

const date = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
const relativeDate = formatRelativeDate(date);
console.log(relativeDate); // "5 minutes ago"
```

### With Custom Options

```typescript
import { formatRelativeDate } from '@hypha-platform/ui-utils';

const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago

// Custom prefix
const withPrefix = formatRelativeDate(date, { prefix: 'Posted' });
console.log(withPrefix); // "Posted 3 hours ago"

// Custom suffix
const withSuffix = formatRelativeDate(date, { suffix: 'before' });
console.log(withSuffix); // "3 hours before"

// No suffix
const noSuffix = formatRelativeDate(date, { suffix: '' });
console.log(noSuffix); // "3 hours"
```

### Short Format

```typescript
import { formatRelativeDateShort } from '@hypha-platform/ui-utils';

const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
const shortFormat = formatRelativeDateShort(date);
console.log(shortFormat); // "2d ago"
```

## API

### formatRelativeDate(dateInput, options)

Formats a date as a relative time string.

**Parameters:**

- `dateInput` (string | number | Date): The date to format
- `options` (RelativeDateOptions): Formatting options
  - `language` (string, optional): Language code (default: 'en')
  - `prefix` (string, optional): Text to prepend to the result (default: '')
  - `suffix` (string, optional): Text to append to the result (default: 'ago')

**Returns:** string

### formatRelativeDateShort(dateInput, options)

Formats a date as a relative time string with short units.

**Parameters:**

- `dateInput` (string | number | Date): The date to format
- `options` (RelativeDateOptions): Formatting options
  - `language` (string, optional): Language code (default: 'en')
  - `prefix` (string, optional): Text to prepend to the result (default: '')
  - `suffix` (string, optional): Text to append to the result (default: 'ago')

**Returns:** string

## Multilingual Support

The utility is designed to support multiple languages. Currently, English and German are supported:

```typescript
// English (default)
formatRelativeDate(new Date(Date.now() - 5 * 60 * 1000)); // "5 minutes ago"

// German
formatRelativeDate(new Date(Date.now() - 5 * 60 * 1000), { language: 'de' }); // "5 Minuten ago"
```

To add support for more languages, extend the `translations` object in `formatRelativeDate.ts`:

```typescript
const translations: Record<string, TimeUnits> = {
  en: defaultTranslations,
  de: {
    second: 'Sekunde',
    minute: 'Minute',
    hour: 'Stunde',
    day: 'Tag',
    month: 'Monat',
    year: 'Jahr',
    seconds: 'Sekunden',
    minutes: 'Minuten',
    hours: 'Stunden',
    days: 'Tage',
    months: 'Monate',
    years: 'Jahre',
  },
  // Add more languages here
  // es: { ...spanish translations... }
};
```

## Examples

```typescript
// Just now
formatRelativeDate(new Date()); // "0 seconds ago"

// Seconds
formatRelativeDate(new Date(Date.now() - 30 * 1000)); // "30 seconds ago"

// Minutes
formatRelativeDate(new Date(Date.now() - 5 * 60 * 1000)); // "5 minutes ago"

// Hours
formatRelativeDate(new Date(Date.now() - 3 * 60 * 60 * 1000)); // "3 hours ago"

// Days
formatRelativeDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)); // "2 days ago"

// Months
formatRelativeDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)); // "2 months ago"

// Years
formatRelativeDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)); // "1 year ago"
```

## Testing

The utility includes comprehensive tests. To run the tests:

```bash
# Run all tests for the ui-utils package
npm test -- packages/ui-utils
```

## Contributing

To add support for more languages:

1. Extend the `translations` object in `formatRelativeDate.ts`
2. Add the new language code to the `translations` record
3. Provide all necessary translations for singular and plural forms

Example:

```typescript
const translations: Record<string, TimeUnits> = {
  en: defaultTranslations,
  es: {
    second: 'segundo',
    seconds: 'segundos',
    minute: 'minuto',
    minutes: 'minutos',
    // ... more translations
  },
};
```

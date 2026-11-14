import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  OWNERSHIP_COLLAPSED_PERIOD,
  PRODUCTION_DEFAULT_TIMEFRAME,
} from '../../components/assets/energy/energy-constants';
import { telemetryPeriodForOwnershipWindow } from '../../components/assets/energy/granularity';

const treasuryDir = join(dirname(fileURLToPath(import.meta.url)), '../..');
const messagesDir = join(treasuryDir, '../../../i18n/src/messages');

const ownershipTab = readFileSync(
  join(treasuryDir, 'components/assets/energy/ownership-tab.tsx'),
  'utf8',
);

const spaceEnergySection = readFileSync(
  join(treasuryDir, 'components/assets/space-energy-section.tsx'),
  'utf8',
);

describe('ownership collapsed telemetry', () => {
  it('reuses the prefetched 7d period instead of a cold 12m aggregate', () => {
    expect(OWNERSHIP_COLLAPSED_PERIOD).toBe('7d');
    expect(OWNERSHIP_COLLAPSED_PERIOD).toBe(PRODUCTION_DEFAULT_TIMEFRAME);
    expect(telemetryPeriodForOwnershipWindow(OWNERSHIP_COLLAPSED_PERIOD)).toBe(
      '7d',
    );
    expect(telemetryPeriodForOwnershipWindow('monthly')).toBe('12m');
    expect(telemetryPeriodForOwnershipWindow('daily')).toBe('30d');
    expect(telemetryPeriodForOwnershipWindow('weekly')).toBe('12w');
  });

  it('collapsed owner rows request 7d production, not monthly/12m', () => {
    expect(ownershipTab).toContain('OWNERSHIP_COLLAPSED_PERIOD');
    expect(ownershipTab).toMatch(
      /useSourceProduction\(\s*group\.sourceIndex,\s*group\.name,\s*OWNERSHIP_COLLAPSED_PERIOD/,
    );
    expect(ownershipTab).not.toMatch(
      /useSourceProduction\(\s*group\.sourceIndex,\s*group\.name,\s*'monthly'/,
    );
    // Disabled (7d not settled) and in-flight must keep the skeleton, not
    // flash placeholder EURC amounts on the earned-from-source line.
    expect(ownershipTab).toMatch(/if \(!enabled \|\| isLoading\)/);
  });

  it('only fetches 30d/12w/12m from an expanded chart after 7d settles', () => {
    expect(ownershipTab).toContain('useEnergySevenDaySettled');
    expect(ownershipTab).toMatch(
      /useState<Granularity>\('daily'\)[\s\S]*sevenDaySettled[\s\S]*useSourceProduction\([\s\S]*granularity,[\s\S]*sevenDaySettled/,
    );
  });

  it('does not add a 12m prefetch that could jump the 7d-then-30d queue', () => {
    expect(spaceEnergySection).toContain('PRODUCTION_DEFAULT_TIMEFRAME');
    expect(spaceEnergySection).toContain("useSpaceEnergyTelemetry('30d'");
    expect(spaceEnergySection).toMatch(
      /sevenDayTelemetry\.data !== undefined \|\|[\s\S]*sevenDayTelemetry\.retriesExhausted/,
    );
    expect(spaceEnergySection).not.toMatch(/useSpaceEnergyTelemetry\(\s*'12m'/);
    expect(spaceEnergySection).not.toMatch(/useSpaceEnergyTelemetry\(\s*'12w'/);
  });

  it('labels collapsed earnings as the last 7 days and keeps prefix/amount interpolation', () => {
    expect(ownershipTab).toMatch(
      /t\('earnedFromSource',\s*\{\s*prefix:[\s\S]*amount:/,
    );

    const expected: Record<string, string> = {
      en: '{prefix}{amount} EURC earned from this source in the last 7 days',
      de: '{prefix}{amount} EURC mit dieser Quelle in den letzten 7 Tagen verdient',
      pt: '{prefix}{amount} EURC ganhos com esta fonte nos últimos 7 dias',
      es: '{prefix}{amount} EURC obtenidos de esta fuente en los últimos 7 días',
      fr: '{prefix}{amount} EURC gagnés depuis cette source au cours des 7 derniers jours',
      nl: '{prefix}{amount} EURC verdiend uit deze bron in de afgelopen 7 dagen',
      no: '{prefix}{amount} EURC opptjent fra denne kilden de siste 7 dagene',
      mk: '{prefix}{amount} EURC заработено од овој извор во последните 7 дена',
    };

    const localeFiles = readdirSync(messagesDir).filter((name) =>
      name.endsWith('.json'),
    );
    expect(localeFiles.sort()).toEqual(
      Object.keys(expected)
        .map((locale) => `${locale}.json`)
        .sort(),
    );

    for (const file of localeFiles) {
      const locale = file.replace(/\.json$/, '');
      const messages = JSON.parse(
        readFileSync(join(messagesDir, file), 'utf8'),
      ) as {
        Energy?: { ownership?: { earnedFromSource?: string } };
      };
      const copy = messages.Energy?.ownership?.earnedFromSource;
      expect({ locale, copy }).toEqual({
        locale,
        copy: expected[locale],
      });
      expect(copy).toContain('{prefix}{amount}');
    }
  });

  it('lets the earned-from-source line wrap at narrow viewports', () => {
    expect(ownershipTab).toMatch(
      /<p className="min-w-0 break-words text-1 text-neutral-11">\s*\{t\('earnedFromSource'/,
    );
    expect(ownershipTab).not.toMatch(
      /<p className="truncate text-1 text-neutral-11">\s*\{t\('earnedFromSource'/,
    );
    expect(ownershipTab).toContain('truncate font-medium text-foreground');
  });
});

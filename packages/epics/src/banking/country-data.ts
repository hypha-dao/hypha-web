export type CountryOption = {
  name: string;
  alpha3: string;
};

// ISO 3166-1 alpha-3 codes for the most common banking destinations.
export const COUNTRIES: CountryOption[] = [
  { name: 'Andorra', alpha3: 'AND' },
  { name: 'Argentina', alpha3: 'ARG' },
  { name: 'Australia', alpha3: 'AUS' },
  { name: 'Austria', alpha3: 'AUT' },
  { name: 'Belgium', alpha3: 'BEL' },
  { name: 'Brazil', alpha3: 'BRA' },
  { name: 'Bulgaria', alpha3: 'BGR' },
  { name: 'Canada', alpha3: 'CAN' },
  { name: 'Chile', alpha3: 'CHL' },
  { name: 'China', alpha3: 'CHN' },
  { name: 'Colombia', alpha3: 'COL' },
  { name: 'Croatia', alpha3: 'HRV' },
  { name: 'Cyprus', alpha3: 'CYP' },
  { name: 'Czech Republic', alpha3: 'CZE' },
  { name: 'Denmark', alpha3: 'DNK' },
  { name: 'Egypt', alpha3: 'EGY' },
  { name: 'Estonia', alpha3: 'EST' },
  { name: 'Finland', alpha3: 'FIN' },
  { name: 'France', alpha3: 'FRA' },
  { name: 'Germany', alpha3: 'DEU' },
  { name: 'Ghana', alpha3: 'GHA' },
  { name: 'Gibraltar', alpha3: 'GIB' },
  { name: 'Greece', alpha3: 'GRC' },
  { name: 'Hong Kong', alpha3: 'HKG' },
  { name: 'Hungary', alpha3: 'HUN' },
  { name: 'Iceland', alpha3: 'ISL' },
  { name: 'India', alpha3: 'IND' },
  { name: 'Indonesia', alpha3: 'IDN' },
  { name: 'Ireland', alpha3: 'IRL' },
  { name: 'Israel', alpha3: 'ISR' },
  { name: 'Italy', alpha3: 'ITA' },
  { name: 'Japan', alpha3: 'JPN' },
  { name: 'Jordan', alpha3: 'JOR' },
  { name: 'Kenya', alpha3: 'KEN' },
  { name: 'Latvia', alpha3: 'LVA' },
  { name: 'Liechtenstein', alpha3: 'LIE' },
  { name: 'Lithuania', alpha3: 'LTU' },
  { name: 'Luxembourg', alpha3: 'LUX' },
  { name: 'Malaysia', alpha3: 'MYS' },
  { name: 'Malta', alpha3: 'MLT' },
  { name: 'Mexico', alpha3: 'MEX' },
  { name: 'Monaco', alpha3: 'MCO' },
  { name: 'Morocco', alpha3: 'MAR' },
  { name: 'Netherlands', alpha3: 'NLD' },
  { name: 'New Zealand', alpha3: 'NZL' },
  { name: 'Nigeria', alpha3: 'NGA' },
  { name: 'Norway', alpha3: 'NOR' },
  { name: 'Pakistan', alpha3: 'PAK' },
  { name: 'Peru', alpha3: 'PER' },
  { name: 'Philippines', alpha3: 'PHL' },
  { name: 'Poland', alpha3: 'POL' },
  { name: 'Portugal', alpha3: 'PRT' },
  { name: 'Romania', alpha3: 'ROU' },
  { name: 'San Marino', alpha3: 'SMR' },
  { name: 'Saudi Arabia', alpha3: 'SAU' },
  { name: 'Singapore', alpha3: 'SGP' },
  { name: 'Slovakia', alpha3: 'SVK' },
  { name: 'Slovenia', alpha3: 'SVN' },
  { name: 'South Africa', alpha3: 'ZAF' },
  { name: 'South Korea', alpha3: 'KOR' },
  { name: 'Spain', alpha3: 'ESP' },
  { name: 'Sweden', alpha3: 'SWE' },
  { name: 'Switzerland', alpha3: 'CHE' },
  { name: 'Thailand', alpha3: 'THA' },
  { name: 'Turkey', alpha3: 'TUR' },
  { name: 'Ukraine', alpha3: 'UKR' },
  { name: 'United Arab Emirates', alpha3: 'ARE' },
  { name: 'United Kingdom', alpha3: 'GBR' },
  { name: 'United States', alpha3: 'USA' },
  { name: 'Uruguay', alpha3: 'URY' },
  { name: 'Vatican City', alpha3: 'VAT' },
  { name: 'Vietnam', alpha3: 'VNM' },
].sort((a, b) => a.name.localeCompare(b.name));

/**
 * Official EPC SEPA Adherence List (alpha-3 codes).
 * Source: European Payments Council — 36 countries/territories as of 2024.
 * https://www.europeanpaymentscouncil.eu/document-library/other/epc-list-sepa-scheme-countries
 */
export const SEPA_ALPHA3 = new Set([
  'AND', 'AUT', 'BEL', 'BGR', 'CHE', 'CYP', 'CZE', 'DEU', 'DNK', 'ESP',
  'EST', 'FIN', 'FRA', 'GBR', 'GIB', 'GRC', 'HRV', 'HUN', 'IRL', 'ISL',
  'ITA', 'LIE', 'LTU', 'LUX', 'LVA', 'MCO', 'MLT', 'NLD', 'NOR', 'POL',
  'PRT', 'ROU', 'SMR', 'SVK', 'SVN', 'SWE', 'VAT',
]);

export const SEPA_COUNTRIES = COUNTRIES.filter((c) => SEPA_ALPHA3.has(c.alpha3));

/**
 * Maps IBAN country prefix (ISO 3166-1 alpha-2) to alpha-3.
 * Covers all current SEPA members; used to derive the bank's country from the IBAN itself.
 */
const IBAN_ALPHA2_TO_ALPHA3: Record<string, string> = {
  AD: 'AND', AT: 'AUT', BE: 'BEL', BG: 'BGR', CH: 'CHE', CY: 'CYP',
  CZ: 'CZE', DE: 'DEU', DK: 'DNK', EE: 'EST', ES: 'ESP', FI: 'FIN',
  FR: 'FRA', GB: 'GBR', GI: 'GIB', GR: 'GRC', HR: 'HRV', HU: 'HUN',
  IE: 'IRL', IS: 'ISL', IT: 'ITA', LI: 'LIE', LT: 'LTU', LU: 'LUX',
  LV: 'LVA', MC: 'MCO', MT: 'MLT', NL: 'NLD', NO: 'NOR', PL: 'POL',
  PT: 'PRT', RO: 'ROU', SE: 'SWE', SI: 'SVN', SK: 'SVK', SM: 'SMR',
  VA: 'VAT',
};

/** Extract the bank's alpha-3 country code from an IBAN string. Returns null if unrecognised. */
export function ibanToAlpha3(iban: string): string | null {
  const alpha2 = iban.replace(/\s/g, '').toUpperCase().slice(0, 2);
  return IBAN_ALPHA2_TO_ALPHA3[alpha2] ?? null;
}

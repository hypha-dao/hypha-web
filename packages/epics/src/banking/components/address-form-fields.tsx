'use client';

import { Input, Label } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

const STREET_MAX_LENGTH = 35;

const SELECT_CLASS =
  'min-h-6 w-full appearance-none rounded border border-input bg-neutral-1 px-3 py-2 text-2 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export type CountryOption = { alpha3: string; name: string };

type ErrorKeys = {
  street: string;
  city: string;
  subdivision: string;
  postal: string;
  country: string;
};

const DEFAULT_ERROR_KEYS: ErrorKeys = {
  street: 'street',
  city: 'city',
  subdivision: 'subdivision',
  postal: 'postal',
  country: 'country',
};

export type AddressFormFieldsProps = {
  idPrefix: string;
  streetLine1: string;
  onStreetLine1Change: (v: string) => void;
  city: string;
  onCityChange: (v: string) => void;
  postalCode: string;
  onPostalCodeChange: (v: string) => void;
  country: string;
  onCountryChange: (v: string) => void;
  countryOptions: CountryOption[];
  // Optional: street line 2 (shown when provided)
  streetLine2?: string;
  onStreetLine2Change?: (v: string) => void;
  // Optional: subdivision / state (shown when provided)
  subdivision?: string;
  onSubdivisionChange?: (v: string) => void;
  subdivisionLabel?: string;
  subdivisionRequired?: boolean;
  subdivisionMaxLength?: number;
  subdivisionPlaceholder?: string;
  // Config
  postalRequired?: boolean;
  disabled?: boolean;
  // Validation
  fieldErrors: Record<string, string>;
  onClearFieldError: (key: string) => void;
  errorKeys?: Partial<ErrorKeys>;
};

export function AddressFormFields({
  idPrefix,
  streetLine1,
  onStreetLine1Change,
  city,
  onCityChange,
  postalCode,
  onPostalCodeChange,
  country,
  onCountryChange,
  countryOptions,
  streetLine2,
  onStreetLine2Change,
  subdivision,
  onSubdivisionChange,
  subdivisionLabel,
  subdivisionRequired = false,
  subdivisionMaxLength,
  subdivisionPlaceholder,
  postalRequired = true,
  disabled = false,
  fieldErrors,
  onClearFieldError,
  errorKeys: overrides,
}: AddressFormFieldsProps) {
  const t = useTranslations('BankingTab.payouts.addDialog');
  const k = { ...DEFAULT_ERROR_KEYS, ...overrides };

  const errClass = (key: string) =>
    fieldErrors[key]
      ? 'border-destructive ring-1 ring-destructive focus-visible:ring-destructive'
      : undefined;

  const FieldErr = ({ errKey }: { errKey: string }) =>
    fieldErrors[errKey] ? (
      <p
        id={`err-${idPrefix}-${errKey}`}
        className="text-1 text-destructive"
        role="alert"
      >
        {fieldErrors[errKey]}
      </p>
    ) : null;

  return (
    <>
      {/* Street line 1 — always required */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-street`}>{t('street')}</Label>
        <Input
          id={`${idPrefix}-street`}
          value={streetLine1}
          onChange={(e) => {
            onStreetLine1Change(e.target.value);
            onClearFieldError(k.street);
          }}
          placeholder={t('streetPlaceholder')}
          maxLength={STREET_MAX_LENGTH}
          disabled={disabled}
          aria-invalid={fieldErrors[k.street] ? true : undefined}
          aria-describedby={
            fieldErrors[k.street] ? `err-${idPrefix}-${k.street}` : undefined
          }
          className={cn(errClass(k.street))}
        />
        <FieldErr errKey={k.street} />
      </div>

      {/* Street line 2 — optional, shown only when prop is provided */}
      {streetLine2 !== undefined && onStreetLine2Change ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-street2`}>{t('street2')}</Label>
          <Input
            id={`${idPrefix}-street2`}
            value={streetLine2}
            onChange={(e) => onStreetLine2Change(e.target.value)}
            placeholder={t('street2Placeholder')}
            maxLength={STREET_MAX_LENGTH}
            disabled={disabled}
          />
        </div>
      ) : null}

      {/* Grid: city | subdivision, postal | country */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-city`}>{t('city')}</Label>
          <Input
            id={`${idPrefix}-city`}
            value={city}
            onChange={(e) => {
              onCityChange(e.target.value);
              onClearFieldError(k.city);
            }}
            disabled={disabled}
            aria-invalid={fieldErrors[k.city] ? true : undefined}
            aria-describedby={
              fieldErrors[k.city] ? `err-${idPrefix}-${k.city}` : undefined
            }
            className={cn(errClass(k.city))}
          />
          <FieldErr errKey={k.city} />
        </div>

        {/* Subdivision / state — shown only when prop is provided */}
        {subdivision !== undefined && onSubdivisionChange ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-subdivision`}>
              {subdivisionLabel ?? t('subdivision')}
            </Label>
            <Input
              id={`${idPrefix}-subdivision`}
              value={subdivision}
              onChange={(e) => {
                onSubdivisionChange(e.target.value);
                if (subdivisionRequired) onClearFieldError(k.subdivision);
              }}
              placeholder={subdivisionPlaceholder}
              maxLength={subdivisionMaxLength}
              disabled={disabled}
              aria-invalid={
                subdivisionRequired && fieldErrors[k.subdivision]
                  ? true
                  : undefined
              }
              aria-describedby={
                subdivisionRequired && fieldErrors[k.subdivision]
                  ? `err-${idPrefix}-${k.subdivision}`
                  : undefined
              }
              className={cn(
                subdivisionRequired ? errClass(k.subdivision) : undefined,
              )}
            />
            {subdivisionRequired ? <FieldErr errKey={k.subdivision} /> : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-postal`}>{t('postalCode')}</Label>
          <Input
            id={`${idPrefix}-postal`}
            value={postalCode}
            onChange={(e) => {
              onPostalCodeChange(e.target.value);
              if (postalRequired) onClearFieldError(k.postal);
            }}
            disabled={disabled}
            aria-invalid={
              postalRequired && fieldErrors[k.postal] ? true : undefined
            }
            aria-describedby={
              postalRequired && fieldErrors[k.postal]
                ? `err-${idPrefix}-${k.postal}`
                : undefined
            }
            className={cn(postalRequired ? errClass(k.postal) : undefined)}
          />
          {postalRequired ? <FieldErr errKey={k.postal} /> : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-country`}>{t('country')}</Label>
          <div className="relative flex min-h-6 w-full items-center">
            <select
              id={`${idPrefix}-country`}
              className={cn(
                SELECT_CLASS,
                fieldErrors[k.country] &&
                  'border-destructive ring-2 ring-destructive',
              )}
              value={country}
              onChange={(e) => {
                onCountryChange(e.target.value);
                onClearFieldError(k.country);
              }}
              disabled={disabled}
              aria-invalid={fieldErrors[k.country] ? true : undefined}
              aria-describedby={
                fieldErrors[k.country]
                  ? `err-${idPrefix}-${k.country}`
                  : undefined
              }
            >
              <option value="">{t('countryPlaceholder')}</option>
              {countryOptions.map((c) => (
                <option key={c.alpha3} value={c.alpha3}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <FieldErr errKey={k.country} />
        </div>
      </div>
    </>
  );
}

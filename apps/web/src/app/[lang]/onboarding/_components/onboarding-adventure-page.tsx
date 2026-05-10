'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import QRCode from 'react-qr-code';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Container,
  Heading,
  Input,
} from '@hypha-platform/ui';
import { copyToClipboard } from '@hypha-platform/ui-utils';
import {
  AlertTriangle,
  Compass,
  Copy,
  Handshake,
  PlusCircle,
  Wallet,
} from 'lucide-react';
import { useAllSpaces } from '@web/hooks/use-all-spaces';
import { Space } from '@hypha-platform/core/client';
import { EXCHANGE_LINKS } from './onboarding-adventure.constants';

const getSpacePath = (lang: string, spaceSlug: string) =>
  `/${lang}/dho/${spaceSlug}/agreements`;

const getNetworkPath = (lang: string) => `/${lang}/network`;
const getCreateSpacePath = (lang: string) => `/${lang}/my-spaces/create`;
const onboardingCardClass =
  'group h-full border-border/70 bg-card/100 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md';
const exchangeButtonBaseClass =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-border/70 bg-background px-3 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const exchangeBrandLogos = {
  coinbase: '/exchange-logos/coinbase.svg',
  wirex: '/exchange-logos/wirex.png',
  kraken: '/exchange-logos/kraken-wordmark.png',
} as const;
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

export function OnboardingAdventurePage() {
  const t = useTranslations('OnboardingAdventure');
  const locale = useLocale();
  const router = useRouter();
  const { spaces, isLoading } = useAllSpaces();

  const [joinSpaceSlug, setJoinSpaceSlug] = useState('');
  const [joinQuery, setJoinQuery] = useState('');
  const [depositSpaceSlug, setDepositSpaceSlug] = useState('');
  const [depositQuery, setDepositQuery] = useState('');
  const [depositDetailsSpaceSlug, setDepositDetailsSpaceSlug] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  const spaceOptions = useMemo(
    () =>
      spaces.map((space) => ({
        value: space.slug,
        label: space.title,
        searchText: `${space.title} ${space.slug}`,
      })),
    [spaces],
  );

  const depositEligibleSpaces = useMemo(
    () => spaces.filter((space) => Boolean(space.address)),
    [spaces],
  );

  const depositOptions = useMemo(
    () =>
      depositEligibleSpaces.map((space) => ({
        value: space.slug,
        label: space.title,
        searchText: `${space.title} ${space.slug}`,
      })),
    [depositEligibleSpaces],
  );

  const selectedDepositSpace = useMemo(
    () =>
      depositEligibleSpaces.find(
        (space) => space.slug === depositDetailsSpaceSlug,
      ) ?? null,
    [depositDetailsSpaceSlug, depositEligibleSpaces],
  );

  const hasJoinChoices = spaceOptions.length > 0;
  const hasDepositChoices = depositOptions.length > 0;

  useEffect(
    () => () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  const handleCopyAddress = (address: string) => {
    copyToClipboard(address);
    setCopiedAddress(true);
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(
      () => setCopiedAddress(false),
      2000,
    );
  };

  const handleDepositSpaceChange = (next: string) => {
    setDepositSpaceSlug(next);
    setDepositDetailsSpaceSlug('');
    setCopiedAddress(false);
  };

  const filterOptionsByQuery = (
    options: Array<{ value: string; label: string; searchText?: string }>,
    query: string,
  ) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return options.filter((option) =>
      (option.searchText ?? option.label).toLowerCase().includes(normalized),
    );
  };

  const renderSelectorCard = ({
    icon,
    title,
    description,
    options,
    query,
    onQueryChange,
    value,
    onChange,
    actionLabel,
    onAction,
    disabled,
    unavailableText,
  }: {
    icon: ReactNode;
    title: string;
    description: string;
    options: Array<{ value: string; label: string; searchText?: string }>;
    query: string;
    onQueryChange: (next: string) => void;
    value: string;
    onChange: (next: string) => void;
    actionLabel: string;
    onAction: () => void;
    disabled: boolean;
    unavailableText: string;
  }) => {
    const filteredOptions = filterOptionsByQuery(options, query);

    return (
      <Card className={onboardingCardClass}>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-5">
            <span className="text-accent-11">{icon}</span>
            {title}
          </CardTitle>
          <CardDescription className="text-2">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('spaceSearchPlaceholder')}
            aria-label={title}
            disabled={disabled}
          />

          {!disabled && !query.trim() ? (
            <p className="text-1 text-muted-foreground">
              {t('searchToSeeSpaces')}
            </p>
          ) : null}

          {!disabled && query.trim() && filteredOptions.length === 0 ? (
            <p className="text-1 text-muted-foreground">{t('noSpacesFound')}</p>
          ) : null}

          {!disabled && filteredOptions.length > 0 ? (
            <div className="max-h-44 space-y-1 overflow-auto rounded-md border border-border/60 p-1">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                  }}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-2 text-foreground transition-colors hover:bg-muted"
                >
                  <span>{option.label}</span>
                  {value === option.value ? (
                    <span className="text-1 text-muted-foreground">
                      {t('selected')}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <Button
            type="button"
            className="w-full"
            onClick={onAction}
            disabled={disabled || !value}
          >
            {actionLabel}
          </Button>
          {disabled ? (
            <p className="text-1 text-muted-foreground">{unavailableText}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  return (
    <Container className="flex flex-col gap-9 py-9">
      <header className="space-y-4">
        <Heading
          size="9"
          color="secondary"
          weight="medium"
          align="center"
          className="flex flex-col"
        >
          <span>{t('title')}</span>
          <span>{t('subtitle')}</span>
        </Heading>
      </header>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className={onboardingCardClass}>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-5">
              <Compass className="size-5 text-accent-11" aria-hidden />
              {t('explore.title')}
            </CardTitle>
            <CardDescription className="text-2">
              {t('explore.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push(getNetworkPath(locale))}
            >
              {t('explore.cta')}
            </Button>
          </CardContent>
        </Card>

        <Card className={onboardingCardClass}>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-5">
              <PlusCircle className="size-5 text-accent-11" aria-hidden />
              {t('create.title')}
            </CardTitle>
            <CardDescription className="text-2">
              {t('create.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push(getCreateSpacePath(locale))}
            >
              {t('create.cta')}
            </Button>
          </CardContent>
        </Card>

        {renderSelectorCard({
          icon: <Handshake className="size-5" aria-hidden />,
          title: t('join.title'),
          description: t('join.description'),
          options: spaceOptions,
          query: joinQuery,
          onQueryChange: (next) => {
            setJoinQuery(next);
            setJoinSpaceSlug('');
          },
          value: joinSpaceSlug,
          onChange: setJoinSpaceSlug,
          actionLabel: t('join.cta'),
          onAction: () => {
            if (!joinSpaceSlug) return;
            router.push(getSpacePath(locale, joinSpaceSlug));
          },
          disabled: isLoading || !hasJoinChoices,
          unavailableText: isLoading
            ? t('loadingSpaces')
            : t('join.unavailable'),
        })}

        {renderSelectorCard({
          icon: <Wallet className="size-5" aria-hidden />,
          title: t('deposit.title'),
          description: t('deposit.description'),
          options: depositOptions,
          query: depositQuery,
          onQueryChange: (next) => {
            setDepositQuery(next);
            setDepositSpaceSlug('');
            setDepositDetailsSpaceSlug('');
            setCopiedAddress(false);
          },
          value: depositSpaceSlug,
          onChange: handleDepositSpaceChange,
          actionLabel: t('deposit.cta'),
          onAction: () => {
            if (!depositSpaceSlug) return;
            setCopiedAddress(false);
            setDepositDetailsSpaceSlug(depositSpaceSlug);
          },
          disabled: isLoading || !hasDepositChoices,
          unavailableText: isLoading
            ? t('loadingSpaces')
            : t('deposit.unavailable'),
        })}
      </section>

      {selectedDepositSpace?.address ? (
        <DepositDetailsCard
          t={t}
          space={selectedDepositSpace}
          copiedAddress={copiedAddress}
          onCopyAddress={handleCopyAddress}
        />
      ) : null}
    </Container>
  );
}

function DepositDetailsCard({
  t,
  space,
  copiedAddress,
  onCopyAddress,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  space: Space;
  copiedAddress: boolean;
  onCopyAddress: (address: string) => void;
}) {
  if (!space.address) return null;

  return (
    <Card className={onboardingCardClass}>
      <CardHeader>
        <CardTitle className="text-5">{t('depositDetails.title')}</CardTitle>
        <CardDescription>
          {t('depositDetails.description', { spaceName: space.title })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-warning-8/60 bg-warning-3 px-3 py-2 text-warning-11">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-1 font-medium">
              {t('depositDetails.networkWarning')}
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-border/70 bg-background/30 p-3">
            <p className="text-1 text-muted-foreground">
              {t('depositDetails.addressLabel')}
            </p>
            <p className="break-all font-mono text-2 text-foreground">
              {space.address}
            </p>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              onClick={() => onCopyAddress(space.address)}
              className="inline-flex min-h-11 items-center gap-2"
            >
              <Copy className="size-4" aria-hidden />
              {copiedAddress
                ? t('depositDetails.copied')
                : t('depositDetails.copy')}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {EXCHANGE_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={exchangeButtonBaseClass}
                aria-label={link.label}
              >
                <img
                  src={exchangeBrandLogos[link.id]}
                  alt=""
                  aria-hidden
                  className="h-5 w-auto max-w-32 object-contain"
                />
              </a>
            ))}
          </div>
        </div>

        <div className="mx-auto rounded-lg border border-border/70 bg-white p-3">
          {evmAddressPattern.test(space.address) ? (
            <QRCode
              value={space.address}
              size={160}
              aria-label={`Space deposit address QR code for ${space.title}`}
            />
          ) : (
            <p className="max-w-40 text-1 text-muted-foreground">
              Invalid treasury address format.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

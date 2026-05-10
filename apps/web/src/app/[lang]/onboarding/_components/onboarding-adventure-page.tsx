'use client';

import { ReactNode, useMemo, useState } from 'react';
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
  'inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const exchangeBrandStyles = {
  coinbase:
    'border border-transparent bg-[#0052FF] text-white hover:bg-[#0048e0]',
  wirex: 'border border-transparent bg-[#1973F6] text-white hover:bg-[#155fd0]',
  kraken:
    'border border-transparent bg-[#6C3BFF] text-white hover:bg-[#5a30d6]',
} as const;

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

  const handleCopyAddress = (address: string) => {
    copyToClipboard(address);
    setCopiedAddress(true);
    window.setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleDepositSpaceChange = (next: string) => {
    setDepositSpaceSlug(next);
    setDepositDetailsSpaceSlug('');
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
                    onQueryChange(option.label);
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
              <Compass className="size-5 text-accent-11" />
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
              <PlusCircle className="size-5 text-accent-11" />
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
          icon: <Handshake className="size-5" />,
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
          icon: <Wallet className="size-5" />,
          title: t('deposit.title'),
          description: t('deposit.description'),
          options: depositOptions,
          query: depositQuery,
          onQueryChange: (next) => {
            setDepositQuery(next);
            setDepositSpaceSlug('');
            setDepositDetailsSpaceSlug('');
          },
          value: depositSpaceSlug,
          onChange: handleDepositSpaceChange,
          actionLabel: t('deposit.cta'),
          onAction: () => {
            if (!depositSpaceSlug) return;
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
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
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
              onClick={() => onCopyAddress(space.address as string)}
              className="inline-flex min-h-11 items-center gap-2"
            >
              <Copy className="size-4" />
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
                className={`${exchangeButtonBaseClass} ${
                  exchangeBrandStyles[link.id]
                }`}
              >
                <ExchangeBrandLogo brand={link.id} />
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mx-auto rounded-lg border border-border/70 bg-white p-3">
          <QRCode value={space.address} size={160} />
        </div>
      </CardContent>
    </Card>
  );
}

function ExchangeBrandLogo({
  brand,
}: {
  brand: (typeof EXCHANGE_LINKS)[number]['id'];
}) {
  if (brand === 'coinbase') {
    return (
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="10" cy="10" r="10" fill="white" />
        <circle cx="10" cy="10" r="6.3" fill="#0052FF" />
        <circle cx="10" cy="10" r="3.8" fill="white" />
      </svg>
    );
  }

  if (brand === 'wirex') {
    return (
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="1.5" y="1.5" width="17" height="17" rx="4.5" fill="white" />
        <path
          d="M5 6.25H8.15L10 8.85L11.85 6.25H15L11.6 10L15 13.75H11.85L10 11.15L8.15 13.75H5L8.4 10L5 6.25Z"
          fill="#1973F6"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 4.8C3 3.81 3.81 3 4.8 3H15.2C16.19 3 17 3.81 17 4.8V8.3C17 9.29 16.19 10.1 15.2 10.1H4.8C3.81 10.1 3 9.29 3 8.3V4.8Z"
        fill="white"
      />
      <circle cx="7" cy="14.7" r="1.8" fill="white" />
      <circle cx="13" cy="14.7" r="1.8" fill="white" />
    </svg>
  );
}

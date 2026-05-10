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
  Combobox,
  Container,
} from '@hypha-platform/ui';
import { copyToClipboard } from '@hypha-platform/ui-utils';
import {
  Compass,
  Copy,
  ExternalLink,
  Handshake,
  PlusCircle,
  Wallet,
} from 'lucide-react';
import { useAllSpaces } from '@web/hooks/use-all-spaces';
import { Space } from '@hypha-platform/core/client';

const EXCHANGE_LINKS = [
  { id: 'coinbase', label: 'Coinbase', href: 'https://www.coinbase.com' },
  { id: 'wirex', label: 'Wirex', href: 'https://wirexapp.com' },
  { id: 'kraken', label: 'Kraken', href: 'https://www.kraken.com' },
] as const;

const getSpacePath = (lang: string, spaceSlug: string) =>
  `/${lang}/dho/${spaceSlug}/agreements`;

const getNetworkPath = (lang: string) => `/${lang}/network`;
const getCreateSpacePath = (lang: string) => `/${lang}/my-spaces/create`;

export function OnboardingAdventurePage() {
  const t = useTranslations('OnboardingAdventure');
  const locale = useLocale();
  const router = useRouter();
  const { spaces, isLoading } = useAllSpaces();

  const [joinSpaceSlug, setJoinSpaceSlug] = useState('');
  const [depositSpaceSlug, setDepositSpaceSlug] = useState('');
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

  const renderSelectorCard = ({
    icon,
    title,
    description,
    options,
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
    value: string;
    onChange: (next: string) => void;
    actionLabel: string;
    onAction: () => void;
    disabled: boolean;
    unavailableText: string;
  }) => (
    <Card className="h-full border-border/60 bg-card/95">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-5">
          <span className="text-accent-11">{icon}</span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Combobox
          options={options}
          placeholder={t('spacePlaceholder')}
          searchPlaceholder={t('spaceSearchPlaceholder')}
          onChange={onChange}
          initialValue={value}
          allowEmptyChoice={false}
          className="w-full md:w-full"
          disabled={disabled}
          emptyListMessage={t('noSpacesFound')}
        />
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

  return (
    <Container className="flex flex-col gap-6 py-8">
      <header className="space-y-2 text-center">
        <h1 className="text-8 font-semibold text-foreground">{t('title')}</h1>
        <p className="text-3 text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="h-full border-border/60 bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-5">
              <Compass className="size-5 text-accent-11" />
              {t('explore.title')}
            </CardTitle>
            <CardDescription>{t('explore.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push(getNetworkPath(locale))}
            >
              {t('explore.cta')}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full border-border/60 bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-5">
              <PlusCircle className="size-5 text-accent-11" />
              {t('create.title')}
            </CardTitle>
            <CardDescription>{t('create.description')}</CardDescription>
          </CardHeader>
          <CardContent>
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
    <Card className="border-border/60 bg-card/95">
      <CardHeader>
        <CardTitle className="text-5">{t('depositDetails.title')}</CardTitle>
        <CardDescription>
          {t('depositDetails.description', { spaceName: space.title })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
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
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-2 text-foreground transition-colors hover:bg-muted"
              >
                <ExternalLink className="size-4 text-muted-foreground" />
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

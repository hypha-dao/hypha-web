'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { Copy } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@hypha-platform/ui';
import { copyToClipboard } from '@hypha-platform/ui-utils';
import { Space, useJwt } from '@hypha-platform/core/client';

const EXCHANGE_LINKS = [
  { id: 'coinbase', label: 'Coinbase', href: 'https://www.coinbase.com' },
  { id: 'wirex', label: 'Wirex', href: 'https://wirexapp.com' },
  { id: 'kraken', label: 'Kraken', href: 'https://www.kraken.com' },
] as const;

const exchangeButtonBaseClass =
  'inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const exchangeBrandStyles = {
  coinbase:
    'border border-transparent bg-[#0052FF] text-white hover:bg-[#0048e0]',
  wirex: 'border border-transparent bg-[#1973F6] text-white hover:bg-[#155fd0]',
  kraken:
    'border border-transparent bg-[#6C3BFF] text-white hover:bg-[#5a30d6]',
} as const;

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

const normalizeEvmAddress = (value: string | null | undefined) =>
  (value ?? '').replace(/\s+/g, '').trim();

type SelectorOption = { value: string; label: string; searchText?: string };

const filterOptionsByQuery = (options: SelectorOption[], query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return options.filter((option) =>
    (option.searchText ?? option.label).toLowerCase().includes(normalized),
  );
};

function useDepositEligibleSpaces() {
  const endpoint = '/api/v1/spaces?parentOnly=false';
  const { jwt } = useJwt();

  const { data, isLoading, error } = useSWR<Space[], Error>(
    [endpoint, jwt],
    ([url]) =>
      fetch(url, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch spaces');
        }
        return res.json();
      }),
  );

  const spaces = useMemo(
    () =>
      (data ?? []).filter((space) =>
        Boolean(normalizeEvmAddress(space.address)),
      ),
    [data],
  );

  return { spaces, isLoading, error };
}

export function FundASpaceFlow() {
  const t = useTranslations('MyWallet.fundSpace');
  const { spaces, isLoading, error } = useDepositEligibleSpaces();
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [detailsSlug, setDetailsSlug] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current != null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const options = useMemo(
    () =>
      spaces.map((space) => ({
        value: space.slug,
        label: space.title,
        searchText: `${space.title} ${space.slug}`,
      })),
    [spaces],
  );

  const filteredOptions = filterOptionsByQuery(options, query);
  const selectedDepositSpace =
    spaces.find((space) => space.slug === detailsSlug) ?? null;
  const hasChoices = options.length > 0;
  const disabled = isLoading || !hasChoices;

  const handleCopyAddress = (address: string) => {
    void copyToClipboard(address);
    setCopiedAddress(true);
    if (copyTimeoutRef.current != null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(
      () => setCopiedAddress(false),
      2000,
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <p className="text-2 text-neutral-11">{t('description')}</p>
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedSlug('');
            setDetailsSlug('');
            setCopiedAddress(false);
          }}
          placeholder={t('searchPlaceholder')}
          aria-label={t('description')}
          disabled={disabled}
          className="h-10 rounded-xl border-border/70 bg-background/80"
        />

        {!disabled && !query.trim() ? (
          <p className="text-1 text-muted-foreground">{t('searchHint')}</p>
        ) : null}

        {!disabled && query.trim() && filteredOptions.length === 0 ? (
          <p className="text-1 text-muted-foreground">{t('noSpacesFound')}</p>
        ) : null}

        {!disabled && filteredOptions.length > 0 ? (
          <div className="max-h-44 space-y-1 overflow-auto rounded-xl border border-border/70 bg-background/65 p-1.5">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSelectedSlug(option.value);
                  setDetailsSlug('');
                  setCopiedAddress(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-2 text-foreground transition-colors hover:bg-muted"
              >
                <span>{option.label}</span>
                {selectedSlug === option.value ? (
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
          className="h-10 w-full rounded-xl border border-foreground bg-foreground text-background uppercase tracking-wide hover:bg-foreground/90"
          onClick={() => {
            if (!selectedSlug) return;
            setCopiedAddress(false);
            setDetailsSlug(selectedSlug);
          }}
          disabled={disabled || !selectedSlug}
        >
          {t('cta')}
        </Button>

        {disabled ? (
          <p className="text-1 text-muted-foreground">
            {isLoading
              ? t('loadingSpaces')
              : error?.message
              ? error.message
              : t('unavailable')}
          </p>
        ) : null}
      </div>

      {selectedDepositSpace?.address ? (
        <DepositDetailsCard
          space={selectedDepositSpace}
          copiedAddress={copiedAddress}
          onCopyAddress={handleCopyAddress}
        />
      ) : null}
    </div>
  );
}

function DepositDetailsCard({
  space,
  copiedAddress,
  onCopyAddress,
}: {
  space: Space;
  copiedAddress: boolean;
  onCopyAddress: (address: string) => void;
}) {
  const t = useTranslations('MyWallet.fundSpace.details');
  const address = normalizeEvmAddress(space.address);
  if (!address) return null;

  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <Card className="mx-auto w-full max-w-md border border-border bg-background-2">
      <CardHeader className="items-center space-y-2 text-center">
        <CardTitle className="text-5">{space.title}</CardTitle>
        <CardDescription className="text-2 text-neutral-11">
          {t('share')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 pb-6">
        <div className="rounded-lg bg-white p-4">
          {evmAddressPattern.test(address) ? (
            <QRCodeSVG
              value={address}
              size={220}
              bgColor="#ffffff"
              fgColor="#111111"
              level="M"
              aria-label={t('qrAriaLabel', { spaceName: space.title })}
            />
          ) : (
            <p className="max-w-40 text-1 text-muted-foreground">
              {t('invalidAddress')}
            </p>
          )}
        </div>
        <p className="w-full rounded-md bg-warning-3 px-3 py-2 text-center text-1 text-warning-11">
          {t('baseOnly')}
        </p>
        <div className="flex w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-3">
          <div className="min-w-0 text-left">
            <p className="text-1 text-neutral-11">{t('addressLabel')}</p>
            <p className="truncate font-mono text-2 text-foreground">
              {shortAddress}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            colorVariant="neutral"
            onClick={() => onCopyAddress(address)}
            className="shrink-0 px-2"
            aria-label={copiedAddress ? t('copied') : t('copy')}
          >
            <Copy className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {EXCHANGE_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${exchangeButtonBaseClass} ${
                exchangeBrandStyles[link.id]
              }`}
              aria-label={link.label}
            >
              <ExchangeBrandLogo brand={link.id} />
              {link.label}
            </a>
          ))}
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

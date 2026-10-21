'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronRight, Copy } from 'lucide-react';
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
import { BankAccountDetailsDialog } from '../../banking/components/bank-account-details-dialog';
import { getCardDepositIdentifiers } from '../../banking/deposit-instruction-display';
import { useVirtualAccounts } from '../../banking/hooks/use-virtual-accounts';
import type { BankVirtualAccountPublic } from '../../banking/hooks/types';
import { prepareWalletActionNavigation } from './open-wallet-action';

const EXCHANGE_LINKS = [
  { id: 'coinbase', label: 'Coinbase', href: 'https://www.coinbase.com' },
  { id: 'wirex', label: 'Wirex', href: 'https://wirexapp.com' },
  { id: 'kraken', label: 'Kraken', href: 'https://www.kraken.com' },
] as const;

const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

const RAIL_LABELS: Record<string, string> = {
  sepa: 'SEPA',
  ach: 'ACH',
  ach_push: 'ACH',
  wire: 'Wire',
  faster_payments: 'Faster Payments',
  spei: 'SPEI',
  pix: 'Pix',
  swift: 'SWIFT',
};

function railLabel(paymentRail: string) {
  return (
    RAIL_LABELS[paymentRail] ??
    paymentRail
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function accountEnding(account: BankVirtualAccountPublic) {
  const identifiers = getCardDepositIdentifiers(
    account.paymentRail,
    account.depositInstructions,
  );
  const value = identifiers.at(-1)?.value ?? '';
  const compact = value.replace(/\s+/g, '');
  if (compact.length < 4) return '';
  return compact.slice(-4);
}

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
          className="h-10 rounded-none border-border bg-background"
        />

        {!disabled && !query.trim() ? (
          <p className="text-1 text-muted-foreground">{t('searchHint')}</p>
        ) : null}

        {!disabled && query.trim() && filteredOptions.length === 0 ? (
          <p className="text-1 text-muted-foreground">{t('noSpacesFound')}</p>
        ) : null}

        {!disabled && filteredOptions.length > 0 ? (
          <div className="max-h-44 space-y-1 overflow-auto border border-border bg-background p-1.5">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSelectedSlug(option.value);
                  setDetailsSlug('');
                  setCopiedAddress(false);
                }}
                className="flex w-full items-center justify-between px-2 py-1.5 text-left text-2 text-foreground hover:bg-neutral-2"
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
          className="h-10 w-full rounded-none"
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
  const params = useParams<{ lang?: string }>();
  const lang = typeof params?.lang === 'string' ? params.lang : 'en';
  const { accounts, isLoading: accountsLoading } = useVirtualAccounts({
    basePath: space.slug ? `/api/v1/spaces/${space.slug}/funding` : undefined,
    enabled: Boolean(space.slug),
  });
  const [openAccount, setOpenAccount] =
    useState<BankVirtualAccountPublic | null>(null);
  const address = normalizeEvmAddress(space.address);
  const walletHref = address
    ? `/${lang}/my-wallet/actions/transfer-funds?${new URLSearchParams({
        to: address,
        name: space.title ?? '',
      }).toString()}`
    : '';

  useEffect(() => {
    setOpenAccount(null);
  }, [space.slug]);

  if (!address) return null;

  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const showBank = accountsLoading || accounts.length > 0;

  return (
    <>
      <Card className="mx-auto w-full max-w-md rounded-none border border-border bg-background shadow-none">
        <CardHeader className="items-center space-y-2 px-6 pt-8 text-center">
          <CardTitle
            className="text-4"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {space.title}
          </CardTitle>
          <CardDescription className="max-w-[36ch] text-2 leading-relaxed text-neutral-11">
            {t('share')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8 px-6 pb-8">
          {showBank ? (
            <FundOptionGroup label={t('bank')}>
              {accountsLoading && accounts.length === 0 ? (
                <p className="px-4 py-4 text-2 text-neutral-11">
                  {t('loadingAccounts')}
                </p>
              ) : (
                accounts.map((account) => {
                  const ending = accountEnding(account);
                  return (
                    <button
                      key={account.id}
                      type="button"
                      className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-neutral-2"
                      onClick={() => setOpenAccount(account)}
                    >
                      <span className="w-12 shrink-0 text-2 tracking-[0.08em] text-foreground uppercase">
                        {account.currency}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-2 text-foreground">
                          {railLabel(account.paymentRail)}
                        </span>
                        {ending ? (
                          <span className="mt-0.5 block font-mono text-1 text-neutral-11">
                            ···· {ending}
                          </span>
                        ) : null}
                      </span>
                      <ChevronRight
                        className="size-4 shrink-0 text-neutral-9"
                        aria-hidden
                      />
                    </button>
                  );
                })
              )}
            </FundOptionGroup>
          ) : null}

          <FundOptionGroup label={t('wallet')}>
            <Link
              href={walletHref}
              scroll={false}
              onClick={() => prepareWalletActionNavigation()}
              className="flex w-full items-center gap-4 px-4 py-4 hover:bg-neutral-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-2 text-foreground">
                  {t('sendFromWallet')}
                </span>
                <span className="mt-0.5 block text-1 text-neutral-11">
                  {t('sendFromWalletHint')}
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-neutral-9"
                aria-hidden
              />
            </Link>
          </FundOptionGroup>

          <FundOptionGroup label={t('onBase')}>
            <div className="flex flex-col items-center gap-4 px-4 py-5">
              <div className="border border-border bg-white p-4">
                {evmAddressPattern.test(address) ? (
                  <QRCodeSVG
                    value={address}
                    size={180}
                    bgColor="#ffffff"
                    fgColor="#111111"
                    level="M"
                    aria-label={t('qrAriaLabel', { spaceName: space.title })}
                  />
                ) : (
                  <p className="max-w-40 text-1 text-neutral-11">
                    {t('invalidAddress')}
                  </p>
                )}
              </div>
              <div className="flex w-full items-center justify-between gap-3">
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
                  className="shrink-0 rounded-none px-2"
                  aria-label={copiedAddress ? t('copied') : t('copy')}
                >
                  <Copy className="size-4" aria-hidden />
                </Button>
              </div>
              <p className="text-center text-1 text-neutral-11">
                {t('baseOnly')}
              </p>
              <p className="text-center text-1 text-neutral-11">
                {EXCHANGE_LINKS.map((link, index) => (
                  <span key={link.id}>
                    {index > 0 ? <span className="px-1.5">·</span> : null}
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-neutral-7 underline-offset-4 hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </span>
                ))}
              </p>
            </div>
          </FundOptionGroup>
        </CardContent>
      </Card>
      <BankAccountDetailsDialog
        account={openAccount}
        open={openAccount != null}
        onOpenChange={(open) => {
          if (!open) setOpenAccount(null);
        }}
      />
    </>
  );
}

function FundOptionGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-1 tracking-[0.16em] text-neutral-11 uppercase">
        {label}
      </h3>
      <div className="divide-y divide-border border border-border">
        {children}
      </div>
    </section>
  );
}

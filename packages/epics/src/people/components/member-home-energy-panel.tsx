'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import {
  bankQrPayload,
  useJwt,
  walletQrPayload,
  type MemberEnergyHomeCommunity,
  type MemberEnergyHomeResponse,
} from '@hypha-platform/core/client';
import { Button, Dialog, DialogContent, DialogTitle } from '@hypha-platform/ui';
import { copyToClipboard } from '@hypha-platform/ui-utils';

function formatKwh(value: number | null, missing: string) {
  if (value == null || !Number.isFinite(value)) return missing;
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function EnergyPayDialog({
  community,
  open,
  onOpenChange,
}: {
  community: MemberEnergyHomeCommunity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('MemberHome.energy');
  const bankAvailable = community.bank != null;
  const [method, setMethod] = useState<'wallet' | 'bank'>(
    community.treasuryAddress ? 'wallet' : 'bank',
  );
  const amount = community.settleAmount;
  const walletValue = walletQrPayload(community.treasuryAddress);
  const bankValue = bankQrPayload(community.bank, amount, community.spaceTitle);
  const showingBank = method === 'bank' && bankAvailable;
  const qrValue = showingBank ? bankValue : walletValue;
  const detail = showingBank
    ? community.bank?.iban ?? community.bank?.accountNumber
    : community.treasuryAddress;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle
          className="pr-8 text-3"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('payTitle', { space: community.spaceTitle })}
        </DialogTitle>
        <p className="text-1 text-neutral-11">
          {amount && amount !== '0.00' ? t('amount', { amount }) : t('nothing')}
        </p>
        {bankAvailable && walletValue ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={method === 'wallet' ? 'default' : 'outline'}
              colorVariant="neutral"
              onClick={() => setMethod('wallet')}
            >
              {t('wallet')}
            </Button>
            <Button
              type="button"
              variant={method === 'bank' ? 'default' : 'outline'}
              colorVariant="neutral"
              onClick={() => setMethod('bank')}
            >
              {t('bank')}
            </Button>
          </div>
        ) : null}
        <p className="text-1 text-neutral-11">
          {showingBank ? t('bankHint') : t('walletHint')}
        </p>
        {qrValue ? (
          <div className="flex justify-center bg-white p-4">
            <QRCodeSVG
              value={qrValue}
              size={180}
              bgColor="#ffffff"
              fgColor="#111111"
              level="M"
            />
          </div>
        ) : (
          <p className="text-1 text-neutral-11">{t('missingPay')}</p>
        )}
        {detail ? (
          <button
            type="button"
            className="break-all text-left text-1 text-neutral-11 underline-offset-2 hover:underline"
            onClick={() => copyToClipboard(detail)}
          >
            {detail}
          </button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EnergyCommunityCard({
  community,
}: {
  community: MemberEnergyHomeCommunity;
}) {
  const t = useTranslations('MemberHome.energy');
  const [open, setOpen] = useState(false);
  const missing = t('missing');
  const canSettle =
    community.settleAmount != null && community.settleAmount !== '0.00';
  const hasBills =
    community.oweThisMonth != null || community.oweLastMonth != null;
  const money = (amount: string | null) =>
    amount == null ? missing : t('euros', { amount });

  return (
    <section className="mb-4 border border-border bg-background p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          className="text-3"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('title')}
        </h2>
        <p className="truncate text-1 tracking-[0.12em] text-neutral-11 uppercase">
          {community.spaceTitle}
        </p>
      </div>
      <p className="mt-4 text-1 tracking-[0.12em] text-neutral-11 uppercase">
        {t('thisMonth')}
      </p>
      <dl className="mt-2 grid gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-1 text-neutral-11">{t('you')}</dt>
          <dd className="text-right text-2 tabular-nums">
            {t('used', { kwh: formatKwh(community.youUsedKwh, missing) })}
            <span className="text-neutral-11"> · </span>
            {t('made', { kwh: formatKwh(community.youMadeKwh, missing) })}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-1 text-neutral-11">{t('community')}</dt>
          <dd className="text-right text-2 tabular-nums">
            {t('used', {
              kwh: formatKwh(community.communityUsedKwh, missing),
            })}
            <span className="text-neutral-11"> · </span>
            {t('made', {
              kwh: formatKwh(community.communityMadeKwh, missing),
            })}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-1 tracking-[0.12em] text-neutral-11 uppercase">
        {t('owe')}
      </p>
      <dl className="mt-2 grid gap-2">
        {hasBills ? (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-1 text-neutral-11">{t('thisMonth')}</dt>
              <dd className="text-2 tabular-nums">
                {money(community.oweThisMonth)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-1 text-neutral-11">{t('lastMonth')}</dt>
              <dd className="text-2 tabular-nums">
                {money(community.oweLastMonth)}
              </dd>
            </div>
          </>
        ) : (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-1 text-neutral-11">{t('toSettle')}</dt>
            <dd className="text-2 tabular-nums">
              {money(community.settleAmount)}
            </dd>
          </div>
        )}
      </dl>
      <Button
        type="button"
        className="mt-4 w-full"
        disabled={!canSettle}
        onClick={() => setOpen(true)}
      >
        {canSettle
          ? t('settleAmount', { amount: community.settleAmount ?? '' })
          : t('settled')}
      </Button>
      <EnergyPayDialog
        community={community}
        open={open}
        onOpenChange={setOpen}
      />
    </section>
  );
}

export function MemberHomeEnergyPanel({ personSlug }: { personSlug: string }) {
  const { jwt } = useJwt();
  const endpoint = `/api/v1/people/${personSlug}/energy/home`;
  const { data } = useSWR(
    jwt ? [endpoint, jwt] : null,
    async ([path, token]) => {
      const response = await fetch(path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch member energy: ${response.status}`);
      }
      return (await response.json()) as MemberEnergyHomeResponse;
    },
    { refreshInterval: 60_000, shouldRetryOnError: false },
  );

  const communities = data?.communities ?? [];
  if (communities.length === 0) return null;

  return (
    <>
      {communities.map((community) => (
        <EnergyCommunityCard key={community.spaceSlug} community={community} />
      ))}
    </>
  );
}

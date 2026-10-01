'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import type { MemberIntelligence } from '@hypha-platform/core/client';

import { getProposalPath } from '../../common/get-path-function';
import type { SignupOrientation } from './signup-flow';

type MemberHomeProps = {
  lang: Locale;
  intelligence: MemberIntelligence;
  isSavingOrientation?: boolean;
  orientationError?: string | null;
  onChooseOrientation: (orientation: SignupOrientation) => void;
};

const ORIENTATIONS: SignupOrientation[] = ['member', 'builder', 'investor'];

function greetingKey(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'greetingMorning' as const;
  if (hour < 18) return 'greetingAfternoon' as const;
  return 'greetingEvening' as const;
}

function shortAddress(address: string) {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function personLabel(
  person: {
    name: string | null;
    surname: string | null;
    nickname: string | null;
  },
  fallback: string,
) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || fallback;
}

export function MemberHome({
  lang,
  intelligence,
  isSavingOrientation,
  orientationError,
  onChooseOrientation,
}: MemberHomeProps) {
  const t = useTranslations('MemberHome');
  const memberFallback = t('fallbackMember');
  const orientation = intelligence.person.primaryOrientation;
  const displayName =
    intelligence.person.name?.trim() ||
    intelligence.person.nickname?.trim() ||
    t('fallbackName');
  const lead = intelligence.attention[0];
  const leadHref = lead
    ? lead.kind === 'proposal'
      ? getProposalPath(lang, lead.spaceSlug, lead.targetSlug)
      : `/${lang}/dho/${lead.spaceSlug}/coherence`
    : null;
  const chatHref = intelligence.chatSpaceSlug
    ? `/${lang}/dho/${intelligence.chatSpaceSlug}/coherence`
    : `/${lang}/network`;

  return (
    <div className="relative mx-auto w-full max-w-3xl px-5 py-8 md:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 h-48 w-full max-w-xl bg-cover bg-right opacity-30 dark:opacity-20"
        style={{
          backgroundImage: 'url(/brand/mycelium.jpg)',
          maskImage: 'linear-gradient(to left, black, transparent)',
        }}
      />
      <div className="relative">
        <h1
          className="text-balance text-8 leading-tight font-medium tracking-[-0.03em]"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t(greetingKey(), { name: displayName })}
        </h1>
        <p className="mt-4 text-1 tracking-[0.16em] text-neutral-11 uppercase">
          {intelligence.counts.connections > 0
            ? t('peopleAround', { count: intelligence.counts.connections })
            : t('peopleAroundEmpty')}
        </p>
        {intelligence.connections.length > 0 ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex">
              {intelligence.connections.slice(0, 5).map((person, index) => (
                <Link
                  key={person.id}
                  href={
                    person.slug
                      ? `/${lang}/profile/${person.slug}`
                      : `/${lang}/network`
                  }
                  title={personLabel(person, memberFallback)}
                  className={cn(
                    'relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-background bg-accent-3 text-1',
                    index > 0 && '-ml-2',
                  )}
                >
                  {person.avatarUrl ? (
                    <img
                      src={person.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    personLabel(person, memberFallback).slice(0, 1)
                  )}
                </Link>
              ))}
            </div>
            <Link
              href={chatHref}
              className="text-2 text-accent-11 underline-offset-4 hover:underline"
            >
              {t('openChat')}
            </Link>
          </div>
        ) : null}

        {orientation == null ? (
          <section className="mt-10 border border-border bg-background/80 p-5">
            <h2
              className="text-4"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('chooseTitle')}
            </h2>
            <p className="mt-2 max-w-[48ch] text-2 leading-relaxed text-neutral-11">
              {t('chooseBody')}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {ORIENTATIONS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
                  disabled={isSavingOrientation}
                  onClick={() => onChooseOrientation(option)}
                >
                  {t(
                    option === 'member'
                      ? 'orientationMember'
                      : option === 'builder'
                      ? 'orientationBuilder'
                      : 'orientationInvestor',
                  )}
                </Button>
              ))}
            </div>
            {orientationError ? (
              <p className="mt-3 text-2 text-error-11" role="alert">
                {orientationError}
              </p>
            ) : null}
          </section>
        ) : (
          <p className="mt-3 text-1 text-neutral-11">
            {t(
              orientation === 'member'
                ? 'orientationMember'
                : orientation === 'builder'
                ? 'orientationBuilder'
                : 'orientationInvestor',
            )}
          </p>
        )}

        <section className="mt-10 border border-border bg-background/85 p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              className="text-4"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('useful')}
            </h2>
            {lead ? (
              <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
                {lead.detail}
              </p>
            ) : null}
          </div>
          {lead ? (
            <div className="mt-4">
              <p className="text-3">{lead.title}</p>
              <p className="mt-1 text-2 text-neutral-11">{lead.detail}</p>
              {leadHref ? (
                <Button asChild className="mt-4">
                  <Link href={leadHref}>
                    {lead.kind === 'proposal' ? t('weighIn') : t('viewSignal')}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-2 text-neutral-11">{t('quiet')}</p>
          )}
          <p className="mt-4 max-w-[52ch] text-2 leading-relaxed text-neutral-12">
            {intelligence.guidance.narrative}
          </p>
        </section>

        <dl className="mt-8 grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <Stat label={t('counts.spaces')} value={intelligence.counts.spaces} />
          <Stat
            label={t('counts.proposals')}
            value={intelligence.counts.openProposals}
          />
          <Stat
            label={t('counts.signals')}
            value={intelligence.counts.signals}
          />
          <Stat
            label={t('counts.people')}
            value={intelligence.counts.connections}
          />
        </dl>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Tile title={t('wallet')}>
            {intelligence.wallet.address ? (
              <p className="font-mono text-2">
                {shortAddress(intelligence.wallet.address)}
              </p>
            ) : (
              <p className="text-2 text-neutral-11">{t('walletEmpty')}</p>
            )}
            {intelligence.wallet.preferredCurrency ? (
              <p className="mt-1 text-1 text-neutral-11">
                {intelligence.wallet.preferredCurrency}
              </p>
            ) : null}
            <TileLink href={`/${lang}/my-wallet`}>{t('openWallet')}</TileLink>
          </Tile>
          <Tile title={t('connections')}>
            {intelligence.connections.length === 0 ? (
              <p className="text-2 text-neutral-11">{t('noConnections')}</p>
            ) : (
              <ul className="grid gap-2">
                {intelligence.connections.slice(0, 4).map((person) => (
                  <li key={person.id}>
                    <Link
                      href={
                        person.slug
                          ? `/${lang}/profile/${person.slug}`
                          : chatHref
                      }
                      className="flex items-baseline justify-between gap-3 text-2 hover:underline"
                    >
                      <span>{personLabel(person, memberFallback)}</span>
                      <span className="text-1 text-neutral-11">
                        {t('sharedSpaces', { count: person.sharedSpaceCount })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <TileLink href={chatHref}>{t('openChat')}</TileLink>
          </Tile>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Tile title={t('spaces')}>
            <ResourceList
              empty={t('noSpaces')}
              items={intelligence.spaces.map((space) => ({
                id: space.id,
                title: space.title,
                detail: space.description,
                href: `/${lang}/dho/${space.slug}/overview`,
              }))}
            />
          </Tile>
          <Tile title={t('signals')}>
            <ResourceList
              empty={t('noSignals')}
              items={intelligence.signals.map((signal) => ({
                id: signal.id,
                title: signal.title,
                detail: signal.spaceTitle,
                href: `/${lang}/dho/${signal.spaceSlug}/coherence`,
              }))}
            />
          </Tile>
          <Tile title={t('notifications')}>
            <ResourceList
              empty={t('noNotifications')}
              items={intelligence.notifications.map((item) => ({
                id: item.id,
                title: item.title,
                detail: item.detail,
                href:
                  item.kind === 'proposal'
                    ? getProposalPath(lang, item.spaceSlug, item.targetSlug)
                    : `/${lang}/dho/${item.spaceSlug}/coherence`,
              }))}
            />
            <TileLink href={`/${lang}/my-spaces/notification-centre`}>
              {t('seeAllNotifications')}
            </TileLink>
          </Tile>
          <Tile title={t('proposals')}>
            <ResourceList
              empty={t('noProposals')}
              items={intelligence.proposals.flatMap((proposal) =>
                proposal.slug
                  ? [
                      {
                        id: proposal.id,
                        title: proposal.title,
                        detail: `${proposal.spaceTitle} · ${
                          proposal.state ?? ''
                        }`,
                        href: getProposalPath(
                          lang,
                          proposal.spaceSlug,
                          proposal.slug,
                        ),
                      },
                    ]
                  : [],
              )}
            />
          </Tile>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href={`/${lang}/my-spaces/create`}>{t('createSpace')}</Link>
          </Button>
        </div>

        {orientation === 'builder' ? (
          <PersonaCard
            title={t('builderTitle')}
            body={t('builderBody')}
            action={t('builderAction')}
            href={`/${lang}/onboarding`}
          />
        ) : null}
        {orientation === 'investor' ? (
          <PersonaCard
            title={t('investorTitle')}
            body={t('investorBody')}
            action={t('investorAction')}
            href={`/${lang}/network/marketplace`}
            meta={t('investorCount', {
              count: intelligence.counts.capitalAsks,
            })}
          />
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background px-4 py-4">
      <dt className="text-1 tracking-[0.14em] text-neutral-11 uppercase">
        {label}
      </dt>
      <dd
        className="mt-2 text-6 tabular-nums"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function Tile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col border border-border bg-background/80 p-4">
      <h2
        className="text-3"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h2>
      <div className="mt-3 flex-1">{children}</div>
    </section>
  );
}

function TileLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-4 inline-block text-2 text-accent-11 underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}

function ResourceList({
  items,
  empty,
}: {
  items: Array<{
    id: string | number;
    title: string;
    detail: string;
    href: string;
  }>;
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-2 text-neutral-11">{empty}</p>;
  }
  return (
    <ul className="grid gap-3">
      {items.slice(0, 4).map((item) => (
        <li key={item.id}>
          <Link href={item.href} className="group block">
            <span className="block text-2 group-hover:underline">
              {item.title}
            </span>
            {item.detail ? (
              <span className="mt-0.5 block text-1 text-neutral-11 line-clamp-2">
                {item.detail}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PersonaCard({
  title,
  body,
  action,
  href,
  meta,
}: {
  title: string;
  body: string;
  action: string;
  href: string;
  meta?: string;
}) {
  return (
    <section className="mt-4 border border-border bg-accent-2 p-5">
      <h2
        className="text-4"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h2>
      <p className="mt-2 max-w-[52ch] text-2 leading-relaxed text-neutral-11">
        {body}
      </p>
      {meta ? <p className="mt-2 text-1 text-neutral-11">{meta}</p> : null}
      <Button asChild className="mt-4">
        <Link href={href}>{action}</Link>
      </Button>
    </section>
  );
}

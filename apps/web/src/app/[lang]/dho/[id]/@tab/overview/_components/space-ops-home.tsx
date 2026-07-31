'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  FileCheck2,
  Plus,
  Settings2,
  UsersRound,
  Wallet,
} from 'lucide-react';
import {
  getDhoPathAgreements,
  PROPOSAL_DOCUMENTS_DEFAULT_ORDER,
  useSpaceDocumentsWithStatuses,
} from '@hypha-platform/epics';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { Button, Skeleton } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';
import { HomeTokenHoldingsDashboardLazy } from './home-token-holdings-dashboard-lazy';

function OpsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <header className="craft-page-header gap-0.5">
        <h2 className="craft-page-title text-4">{title}</h2>
        {description ? <p className="craft-meta">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function SpaceOpsHome({ spaceSlug }: { spaceSlug: string }) {
  const params = useParams();
  const lang = (params?.lang as Locale) || 'en';
  const t = useTranslations('OverviewOps');
  const tCommon = useTranslations('Common');
  const tModal = useTranslations('ModalAside');
  const { space } = useSpaceBySlug(spaceSlug);
  const web3SpaceId = space?.web3SpaceId;

  const { documents, isLoading } = useSpaceDocumentsWithStatuses({
    spaceSlug,
    spaceId: web3SpaceId,
    order: PROPOSAL_DOCUMENTS_DEFAULT_ORDER,
  });

  const onVoting = documents.onVoting.slice(0, 5);
  const recent = React.useMemo(() => {
    const merged = [
      ...documents.onVoting,
      ...documents.accepted,
      ...documents.rejected,
    ]
      .filter((d) => d.slug)
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 6);
    return merged;
  }, [documents]);

  const agreementsBase = getDhoPathAgreements(lang, spaceSlug);
  const createHref = `${agreementsBase}/select-create-action`;
  const settingsHref = `${agreementsBase}/select-settings-action`;
  const membersHref = `/${lang}/dho/${spaceSlug}/members`;
  const treasuryHref = `/${lang}/dho/${spaceSlug}/treasury`;
  const votingHref = agreementsBase;

  return (
    <div className="flex flex-col gap-8 py-4 md:gap-10">
      <OpsSection
        title={t('needsAttentionTitle')}
        description={t('needsAttentionDescription')}
      >
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : onVoting.length === 0 ? (
          <div className="craft-card flex items-center justify-between gap-4 p-4">
            <div className="flex items-start gap-3">
              <span className="craft-empty-mark" aria-hidden>
                <FileCheck2 className="size-4" />
              </span>
              <div>
                <p className="text-2 font-medium text-foreground">
                  {t('noOpenVotesTitle')}
                </p>
                <p className="craft-meta mt-0.5">
                  {t('noOpenVotesDescription')}
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href={createHref}>{t('createProposal')}</Link>
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {onVoting.map((doc) => (
              <li key={doc.slug ?? doc.id}>
                <Link
                  href={`${agreementsBase}/proposal/${doc.slug}`}
                  className={cn(
                    'craft-card-interactive flex items-center justify-between gap-3 p-3.5',
                    'text-foreground no-underline',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-2 font-medium">
                      {doc.title || t('untitledProposal')}
                    </p>
                    <p className="craft-meta mt-0.5">{t('statusOnVoting')}</p>
                  </div>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
            {documents.onVoting.length > onVoting.length ? (
              <li>
                <Link
                  href={votingHref}
                  className="craft-meta inline-flex items-center gap-1 px-1 hover:text-foreground"
                >
                  {t('viewAllOpenVotes', {
                    count: documents.onVoting.length,
                  })}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </OpsSection>

      <OpsSection title={t('quickActionsTitle')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            asChild
            variant="outline"
            colorVariant="neutral"
            className="h-auto justify-start gap-2 px-3 py-3"
          >
            <Link href={createHref}>
              <Plus className="size-4 shrink-0" aria-hidden />
              <span className="text-left text-2">{t('createProposal')}</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            colorVariant="neutral"
            className="h-auto justify-start gap-2 px-3 py-3"
          >
            <Link href={membersHref}>
              <UsersRound className="size-4 shrink-0" aria-hidden />
              <span className="text-left text-2">{t('inviteMembers')}</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            colorVariant="neutral"
            className="h-auto justify-start gap-2 px-3 py-3"
          >
            <Link href={treasuryHref}>
              <Wallet className="size-4 shrink-0" aria-hidden />
              <span className="text-left text-2">{tCommon('Treasury')}</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            colorVariant="neutral"
            className="h-auto justify-start gap-2 px-3 py-3"
          >
            <Link href={settingsHref}>
              <Settings2 className="size-4 shrink-0" aria-hidden />
              <span className="text-left text-2">
                {tModal('spaceSettings')}
              </span>
            </Link>
          </Button>
        </div>
      </OpsSection>

      <OpsSection
        title={t('recentActivityTitle')}
        description={t('recentActivityDescription')}
      >
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : recent.length === 0 ? (
          <p className="craft-meta">{t('noRecentActivity')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {recent.map((doc) => (
              <li key={`recent-${doc.slug ?? doc.id}`}>
                <Link
                  href={`${agreementsBase}/proposal/${doc.slug}`}
                  className="craft-row-interactive flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 no-underline"
                >
                  <span className="truncate text-2 text-foreground">
                    {doc.title || t('untitledProposal')}
                  </span>
                  <span className="craft-meta shrink-0 capitalize">
                    {doc.status === 'onVoting'
                      ? t('statusOnVoting')
                      : doc.status === 'accepted'
                      ? t('statusAccepted')
                      : doc.status === 'rejected'
                      ? t('statusRejected')
                      : doc.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OpsSection>

      <OpsSection
        title={t('holdingsTitle')}
        description={t('holdingsDescription')}
        className="border-t border-border/60 pt-8"
      >
        <HomeTokenHoldingsDashboardLazy spaceSlug={spaceSlug} />
      </OpsSection>
    </div>
  );
}

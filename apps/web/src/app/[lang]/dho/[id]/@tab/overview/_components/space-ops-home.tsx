'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight, FileCheck2 } from 'lucide-react';
import {
  getDhoPathAgreements,
  PersonLabel,
  PROPOSAL_DOCUMENTS_DEFAULT_ORDER,
  useSpaceDocumentsWithStatuses,
} from '@hypha-platform/epics';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { Skeleton } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';
import { TabScreenTitle } from '../../_components/tab-screen-title';
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
    <section className={cn('flex flex-col gap-2', className)}>
      <header className="flex flex-col gap-0.5">
        <h2 className="text-2 font-medium text-foreground">{title}</h2>
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
  const { space } = useSpaceBySlug(spaceSlug);
  const web3SpaceId = space?.web3SpaceId;

  const { documents, isLoading } = useSpaceDocumentsWithStatuses({
    spaceSlug,
    spaceId: web3SpaceId,
    order: PROPOSAL_DOCUMENTS_DEFAULT_ORDER,
  });

  const onVoting = documents.onVoting.slice(0, 5);
  const agreementsBase = getDhoPathAgreements(lang, spaceSlug);
  const votingHref = agreementsBase;

  return (
    <div className="flex flex-col gap-5 py-4 md:gap-6">
      <TabScreenTitle title={tCommon('home')} />

      <OpsSection
        title={t('needsAttentionTitle')}
        description={t('needsAttentionDescription')}
      >
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : onVoting.length === 0 ? (
          <div className="craft-card flex items-start gap-3 p-4">
            <span className="craft-empty-mark" aria-hidden>
              <FileCheck2 className="size-4" />
            </span>
            <div>
              <p className="text-2 font-medium text-foreground">
                {t('noOpenVotesTitle')}
              </p>
              <p className="craft-meta mt-0.5">{t('noOpenVotesDescription')}</p>
            </div>
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
                    <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden">
                      {doc.creator ? (
                        <div className="min-w-0 overflow-hidden">
                          <PersonLabel creator={doc.creator} />
                        </div>
                      ) : null}
                      <span className="craft-meta shrink-0">
                        {doc.creator ? '· ' : null}
                        {t('statusOnVoting')}
                      </span>
                    </div>
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

      <section className="flex flex-col gap-3 border-t border-border/60 pt-5">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-2 font-medium text-foreground">
            {t('holdingsTitle')}
          </h2>
          <p className="craft-meta">{t('holdingsDescription')}</p>
        </header>
        <HomeTokenHoldingsDashboardLazy spaceSlug={spaceSlug} />
      </section>
    </div>
  );
}

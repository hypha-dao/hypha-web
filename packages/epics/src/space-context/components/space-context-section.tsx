'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  statusMatchesFilter,
  type SpaceContextFilter,
  type SpaceContextSectionKey,
} from '@hypha-platform/core/client';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { Button, Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import {
  importSpaceContextFromMemoryRequest,
  useSpaceContext,
} from '../hooks/use-space-context';
import { SpaceContextCard } from './space-context-card';
import { SpaceContextChatPanel } from './space-context-chat-panel';
import { SpaceContextEmpty } from './space-context-empty';
import { SpaceContextPassedBanner } from './space-context-passed-banner';

const FILTERS: SpaceContextFilter[] = ['all', 'ratified', 'proposed', 'drafts'];

export function SpaceContextSection({ spaceSlug }: { spaceSlug: string }) {
  const t = useTranslations('SpaceContext');
  const locale = useLocale();
  const router = useRouter();
  const { getAccessToken } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const { canMutate } = useCanMutateInSpace({ spaceSlug, space });
  const { overview, error, isLoading, refresh } = useSpaceContext(spaceSlug);
  const [filter, setFilter] = useState<SpaceContextFilter>('all');
  const [openSection, setOpenSection] = useState<SpaceContextSectionKey | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sections = overview?.sections ?? [];
  const allEmpty = sections.every((section) => !section.markdown.trim());
  const hasEligibleSection = sections.some(
    (section) =>
      section.status === 'draft' ||
      ((section.status === 'not_started' || section.status === 'ratified') &&
        section.markdown.trim()),
  );
  const ratifiedPercent =
    overview && overview.totalCount > 0
      ? Math.round((overview.ratifiedCount / overview.totalCount) * 100)
      : 0;
  const featured = sections.find(
    (section) =>
      section.sectionKey === 'mission' && section.status === 'ratified',
  );
  const visible = useMemo(
    () =>
      sections.filter(
        (section) =>
          statusMatchesFilter(section.status, filter) &&
          !(featured && section.sectionKey === 'mission' && filter === 'all'),
      ),
    [featured, filter, sections],
  );

  const proposeHref = `/${locale}/dho/${spaceSlug}/context/create`;
  const proposeSections = (keys: SpaceContextSectionKey[]) => {
    const query = new URLSearchParams({ sections: keys.join(',') });
    router.push(`${proposeHref}?${query.toString()}`);
  };

  const handleImport = async () => {
    setImportError(null);
    setImporting(true);
    try {
      await importSpaceContextFromMemoryRequest({
        spaceSlug,
        getAccessToken,
      });
      setSuccessMessage(t('success.imported'));
      setOpenSection('mission');
      await refresh();
    } catch {
      setImportError(t('error.import'));
    } finally {
      setImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="border border-error-6 bg-background-2 px-4 py-6">
        <p className="text-2 text-error-11">{t('error.load')}</p>
        <Button
          type="button"
          className="mt-3"
          variant="outline"
          colorVariant="neutral"
          onClick={() => void refresh()}
        >
          {t('error.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1 space-y-6">
        <SpaceContextPassedBanner spaceSlug={spaceSlug} sections={sections} />

        <header className="craft-page-header space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="craft-page-title">{t('title')}</h1>
              <p className="mt-1 max-w-2xl text-2 text-neutral-11">
                {t('subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:justify-end">
              <div className="flex items-center gap-3">
                <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                  {t('progress', {
                    ratified: overview.ratifiedCount,
                    total: overview.totalCount,
                  })}
                </p>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={ratifiedPercent}
                  aria-label={t('progress', {
                    ratified: overview.ratifiedCount,
                    total: overview.totalCount,
                  })}
                  className="h-1 w-24 overflow-hidden bg-neutral-5"
                >
                  <div
                    className="h-full bg-success-9 transition-[width]"
                    style={{ width: `${ratifiedPercent}%` }}
                  />
                </div>
              </div>
              {canMutate && hasEligibleSection ? (
                <Button type="button" onClick={() => router.push(proposeHref)}>
                  {t('propose')}
                </Button>
              ) : null}
            </div>
          </div>
          {successMessage ? (
            <p className="text-2 text-success-11">{successMessage}</p>
          ) : null}
          {importError ? (
            <p className="text-2 text-error-11">{importError}</p>
          ) : null}
        </header>

        <div
          role="tablist"
          aria-label={t('title')}
          className="flex flex-wrap gap-6 border-b border-border/60"
        >
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={filter === item}
              className={cn(
                '-mb-px border-b-2 pb-2 text-1 uppercase tracking-[0.12em] transition-colors',
                filter === item
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-neutral-11 hover:text-foreground',
              )}
              onClick={() => setFilter(item)}
            >
              {t(`filters.${item}`)}
            </button>
          ))}
        </div>

        {allEmpty && filter === 'all' ? (
          <SpaceContextEmpty
            canMutate={canMutate}
            importing={importing}
            onStartMission={() => setOpenSection('mission')}
            onImportMemory={() => void handleImport()}
          />
        ) : null}

        {featured && filter === 'all' ? (
          <SpaceContextCard
            section={featured}
            spaceSlug={spaceSlug}
            featured
            selected={openSection === featured.sectionKey}
            canMutate={canMutate}
            onOpen={setOpenSection}
            onProposeAmendment={(key) => proposeSections([key])}
          />
        ) : null}

        {visible.length === 0 && !allEmpty ? (
          <p className="text-2 text-neutral-11">{t('empty.filter')}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((section) => (
              <SpaceContextCard
                key={section.sectionKey}
                section={section}
                spaceSlug={spaceSlug}
                selected={openSection === section.sectionKey}
                canMutate={canMutate}
                onOpen={setOpenSection}
              />
            ))}
          </div>
        )}
      </div>

      {openSection ? (
        <div className="xl:sticky xl:top-4 xl:self-start">
          <SpaceContextChatPanel
            spaceSlug={spaceSlug}
            spaceTitle={overview.spaceTitle}
            sectionKey={openSection}
            canMutate={canMutate}
            onClose={() => setOpenSection(null)}
            onDraftSaved={async () => {
              setSuccessMessage(t('success.saved'));
              await refresh();
            }}
            onPropose={proposeSections}
          />
        </div>
      ) : null}
    </div>
  );
}

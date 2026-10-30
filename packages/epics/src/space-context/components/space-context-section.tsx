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
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
  const filterTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleFilterKeyDown = (event: KeyboardEvent, index: number) => {
    let next: number | null = null;
    if (event.key === 'ArrowRight') {
      next = (index + 1) % FILTERS.length;
    } else if (event.key === 'ArrowLeft') {
      next = (index - 1 + FILTERS.length) % FILTERS.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = FILTERS.length - 1;
    }
    const nextFilter = next == null ? undefined : FILTERS[next];
    if (next == null || !nextFilter) return;
    event.preventDefault();
    setFilter(nextFilter);
    filterTabRefs.current[next]?.focus();
  };
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
              <div className="flex flex-col items-start gap-1.5 sm:items-end">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground">
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
                  className="h-1 w-[200px] max-w-full overflow-hidden bg-neutral-4"
                >
                  <div
                    className="h-full bg-success-11 transition-[width]"
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

        <div className="h-px w-full bg-foreground" aria-hidden />

        <div
          role="tablist"
          aria-label={t('title')}
          className="-mt-2 flex flex-wrap gap-5"
        >
          {FILTERS.map((item, index) => (
            <button
              key={item}
              ref={(node) => {
                filterTabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              aria-selected={filter === item}
              tabIndex={filter === item ? 0 : -1}
              className={cn(
                'border-b-[1.5px] pb-1 text-[10px] uppercase tracking-[0.1em] transition-colors',
                filter === item
                  ? 'border-foreground font-bold text-foreground'
                  : 'border-transparent font-medium text-neutral-11 hover:text-foreground',
              )}
              onClick={() => setFilter(item)}
              onKeyDown={(event) => handleFilterKeyDown(event, index)}
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

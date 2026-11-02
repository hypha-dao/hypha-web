'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  isProposableSection,
  officialSectionMarkdown,
  sectionMatchesFilter,
  type SpaceContextFilter,
  type SpaceContextSectionKey,
} from '@hypha-platform/core/client';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { Button, Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import {
  importSpaceContextFromMemoryRequest,
  useSpaceContext,
} from '../hooks/use-space-context';
import { SpaceContextAddSectionDialog } from './space-context-add-section-dialog';
import { SpaceContextCard } from './space-context-card';
import { SpaceContextChatPanel } from './space-context-chat-panel';
import {
  SpaceContextDraftDialog,
  SpaceContextReadDialog,
} from './space-context-dialogs';
import { SpaceContextEmpty } from './space-context-empty';
import { spaceContextProposeHref } from './propose-href';

const FILTERS: SpaceContextFilter[] = ['all', 'ratified', 'proposed', 'drafts'];
const SECTION_PARAM = 'section';

/** Mirrors the open section into `?section=` so the panel can be linked. */
function writeSectionParam(sectionKey: SpaceContextSectionKey | null) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (sectionKey) params.set(SECTION_PARAM, sectionKey);
  else params.delete(SECTION_PARAM);
  const query = params.toString();
  const href = `${window.location.pathname}${query ? `?${query}` : ''}`;
  if (href === `${window.location.pathname}${window.location.search}`) return;
  window.history.replaceState(window.history.state, '', href);
}

export function SpaceContextSection({ spaceSlug }: { spaceSlug: string }) {
  const t = useTranslations('SpaceContext');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const {
    panelAvailable,
    spaceContextSection,
    openSpaceContextSection,
    closeSpaceContextSection,
  } = useHumanChatPanel();
  const [inlineSection, setInlineSection] =
    useState<SpaceContextSectionKey | null>(null);
  const openSection = panelAvailable
    ? spaceContextSection?.spaceSlug === spaceSlug
      ? spaceContextSection.sectionKey
      : null
    : inlineSection;
  const [readingKey, setReadingKey] = useState<SpaceContextSectionKey | null>(
    null,
  );
  const [draftKey, setDraftKey] = useState<SpaceContextSectionKey | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sections = useMemo(() => overview?.sections ?? [], [overview]);
  const allEmpty = sections.every(
    (section) => !section.markdown.trim() && !section.ratifiedMarkdown?.trim(),
  );
  const hasEligibleSection = sections.some(isProposableSection);

  const showSection = useCallback(
    (sectionKey: SpaceContextSectionKey) => {
      if (panelAvailable) {
        openSpaceContextSection({ spaceSlug, sectionKey });
      } else {
        setInlineSection(sectionKey);
      }
      writeSectionParam(sectionKey);
    },
    [openSpaceContextSection, panelAvailable, spaceSlug],
  );
  const hideSection = useCallback(() => {
    if (panelAvailable) closeSpaceContextSection();
    else setInlineSection(null);
  }, [closeSpaceContextSection, panelAvailable]);

  useEffect(() => {
    if (!overview || !openSection) return;
    if (!sections.some((section) => section.sectionKey === openSection)) {
      hideSection();
    }
  }, [hideSection, openSection, overview, sections]);

  const sectionParam = searchParams?.get(SECTION_PARAM)?.trim() || null;
  const appliedSectionParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (!overview || !sectionParam) return;
    if (appliedSectionParamRef.current === sectionParam) return;
    appliedSectionParamRef.current = sectionParam;
    const linked = sections.find(
      (section) => section.sectionKey === sectionParam,
    );
    if (linked) showSection(linked.sectionKey);
  }, [overview, sectionParam, sections, showSection]);

  const shownSectionRef = useRef(openSection);
  useEffect(() => {
    if (shownSectionRef.current && !openSection) writeSectionParam(null);
    shownSectionRef.current = openSection;
  }, [openSection]);
  const ratifiedPercent =
    overview && overview.totalCount > 0
      ? Math.round((overview.ratifiedCount / overview.totalCount) * 100)
      : 0;
  const featured = sections.find(
    (section) =>
      section.sectionKey === 'mission' &&
      officialSectionMarkdown(section) != null,
  );
  const visible = useMemo(
    () =>
      sections.filter(
        (section) =>
          sectionMatchesFilter(section, filter) &&
          !(featured && section.sectionKey === 'mission' && filter === 'all'),
      ),
    [featured, filter, sections],
  );

  const readingSection =
    sections.find((section) => section.sectionKey === readingKey) ?? null;
  const draftSection =
    sections.find((section) => section.sectionKey === draftKey) ?? null;

  const proposeHref = spaceContextProposeHref(locale, spaceSlug);
  const proposeSections = (keys: SpaceContextSectionKey[]) => {
    router.push(spaceContextProposeHref(locale, spaceSlug, keys));
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
      showSection('mission');
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
              {canMutate ? (
                <Button
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
                  className="gap-1.5"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="size-4" strokeWidth={1.25} aria-hidden />
                  {t('addSection.open')}
                </Button>
              ) : null}
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
            onStartMission={() => showSection('mission')}
            onImportMemory={() => void handleImport()}
          />
        ) : null}

        {featured && filter === 'all' ? (
          <SpaceContextCard
            section={featured}
            spaceSlug={spaceSlug}
            featured
            selected={openSection === featured.sectionKey}
            onOpen={showSection}
            onRead={setReadingKey}
            onShowDraft={setDraftKey}
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
                onOpen={showSection}
                onRead={setReadingKey}
                onShowDraft={setDraftKey}
              />
            ))}
          </div>
        )}
      </div>

      <SpaceContextReadDialog
        section={readingSection}
        spaceSlug={spaceSlug}
        canMutate={canMutate}
        onClose={() => setReadingKey(null)}
      />
      {draftSection ? (
        <SpaceContextDraftDialog
          open
          onOpenChange={(open) => {
            if (!open) setDraftKey(null);
          }}
          spaceSlug={spaceSlug}
          sectionKey={draftSection.sectionKey}
          sectionTitle={draftSection.title}
          markdown={draftSection.markdown}
          canEdit={canMutate}
          onVoting={draftSection.status === 'proposed'}
        />
      ) : null}

      {canMutate ? (
        <SpaceContextAddSectionDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          spaceSlug={spaceSlug}
          removedSections={overview.removedSections ?? []}
          onSuggested={async (key) => {
            setSuccessMessage(t('success.suggested'));
            await refresh();
            showSection(key);
          }}
        />
      ) : null}

      {openSection && !panelAvailable ? (
        <div className="xl:sticky xl:top-4 xl:self-start">
          <SpaceContextChatPanel
            spaceSlug={spaceSlug}
            spaceTitle={overview.spaceTitle}
            sectionKey={openSection}
            canMutate={canMutate}
            onClose={hideSection}
            onPropose={proposeSections}
          />
        </div>
      ) : null}
    </div>
  );
}

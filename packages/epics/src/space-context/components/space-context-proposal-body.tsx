'use client';

import {
  headingForSectionKey,
  splitProposalMarkdownSections,
  type SpaceContextSectionKey,
  type SpaceContextStatus,
} from '@hypha-platform/core/client';
import { Badge } from '@hypha-platform/ui';
import { ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo } from 'react';
import { MemoryProse } from '../../coherence/components/memory-prose';
import { useSpaceContext } from '../hooks/use-space-context';
import { SpaceContextStatusChip } from './space-context-status-chip';

const FIELD_LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground';

/** Structured view of a "Ratify context" proposal: the sections it ratifies and their text. */
export function SpaceContextProposalBody({
  spaceSlug,
  documentId,
  content,
}: {
  spaceSlug?: string;
  documentId?: number;
  content?: string;
}) {
  const t = useTranslations('SpaceContext');
  const locale = useLocale();
  const { overview } = useSpaceContext(spaceSlug);
  const parsed = useMemo(
    () => splitProposalMarkdownSections(content ?? ''),
    [content],
  );

  const rows = useMemo(() => {
    const linked =
      documentId == null
        ? []
        : (overview?.sections ?? []).filter(
            (section) =>
              section.proposalDocumentId === documentId ||
              section.ratifiedDocumentId === documentId,
          );
    const statusByKey = new Map<SpaceContextSectionKey, SpaceContextStatus>(
      linked.map((section) => [section.sectionKey, section.status]),
    );
    const keys: SpaceContextSectionKey[] = [
      ...parsed.sections.map((section) => section.key),
      ...linked
        .map((section) => section.sectionKey)
        .filter((key) => !parsed.sections.some((s) => s.key === key)),
    ];
    return keys.map((key) => ({ key, status: statusByKey.get(key) ?? null }));
  }, [documentId, overview?.sections, parsed.sections]);

  const passed =
    rows.length > 0 && rows.every((row) => row.status === 'ratified');

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-2">
        <p className={FIELD_LABEL_CLASS}>{t('proposeForm.proposalType')}</p>
        <Badge
          variant="outline"
          colorVariant="neutral"
          className="uppercase tracking-[0.12em]"
        >
          {t('proposeForm.proposalTypeValue')}
        </Badge>
      </div>

      {rows.length > 0 ? (
        <div className="space-y-2">
          <p className={FIELD_LABEL_CLASS}>{t('proposeForm.sections')}</p>
          <ul className="divide-y divide-border/70 border border-border/70">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <span className="text-2 font-semibold text-foreground">
                  {headingForSectionKey(row.key)}
                </span>
                {row.status ? (
                  <SpaceContextStatusChip status={row.status} />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parsed.intro ? (
        <MemoryProse
          source={parsed.intro}
          className="text-2 leading-relaxed text-neutral-12"
        />
      ) : null}

      {parsed.sections.map((section) => (
        <section
          key={section.key}
          className="space-y-2 border border-border/70 bg-background-2 p-4"
        >
          <h3 className="text-4 font-semibold text-foreground">
            {section.title}
          </h3>
          {section.markdown ? (
            <MemoryProse
              source={section.markdown}
              className="text-2 leading-relaxed text-neutral-12"
            />
          ) : (
            <p className="text-2 text-neutral-11">{t('card.emptyBody')}</p>
          )}
        </section>
      ))}

      <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-1 text-neutral-11">
          {passed ? t('proposal.passedNote') : t('proposeForm.onPassNote')}
        </p>
        {spaceSlug ? (
          <Link
            href={`/${locale}/dho/${spaceSlug}/context`}
            className="inline-flex shrink-0 items-center gap-1.5 text-1 uppercase tracking-[0.12em] text-neutral-12 hover:underline"
          >
            {t('proposal.openContext')}
            <ArrowRight className="size-3.5" strokeWidth={1.25} aria-hidden />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

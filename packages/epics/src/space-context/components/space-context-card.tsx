'use client';

import {
  firstMarkdownParagraph,
  headingForSectionKey,
  type SpaceContextSectionKey,
  type SpaceContextSectionRecord,
} from '@hypha-platform/core/client';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MemoryProse } from '../../coherence/components/memory-prose';
import { SpaceContextStatusChip } from './space-context-status-chip';

export function SpaceContextCard({
  section,
  selected,
  featured,
  canMutate,
  onOpen,
  onViewProposal,
}: {
  section: SpaceContextSectionRecord;
  selected?: boolean;
  featured?: boolean;
  canMutate: boolean;
  onOpen: (key: SpaceContextSectionKey) => void;
  onViewProposal?: (slug: string) => void;
}) {
  const t = useTranslations('SpaceContext');
  const title = headingForSectionKey(section.sectionKey);
  const empty = !section.markdown.trim();
  const lead = empty ? '' : firstMarkdownParagraph(section.markdown);
  const footer = footerCopy(section, t);

  return (
    <Card
      className={cn(
        'flex h-full min-h-[280px] flex-col border-border/70',
        featured && 'border-success-8',
        selected && 'border-foreground',
        empty && !featured && 'border-dashed',
      )}
    >
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-4">{title}</CardTitle>
          <p className="mt-1 text-1 text-neutral-11">
            {t(`leads.${section.sectionKey}`)}
          </p>
        </div>
        <SpaceContextStatusChip status={section.status} />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0">
        <div className="min-h-24">
          {empty ? (
            <p className="text-2 text-neutral-11">{t('card.emptyBody')}</p>
          ) : (
            <MemoryProse
              source={featured ? section.markdown : lead}
              className={cn(
                'text-2 leading-relaxed text-neutral-12',
                !featured && 'line-clamp-6',
              )}
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          <p className="min-w-0 truncate text-1 text-neutral-11">{footer}</p>
          <Button
            type="button"
            variant="ghost"
            colorVariant="neutral"
            className="h-10 shrink-0 gap-1.5 px-3"
            onClick={() => {
              if (
                section.status === 'proposed' &&
                section.proposalSlug &&
                onViewProposal
              ) {
                onViewProposal(section.proposalSlug);
                return;
              }
              onOpen(section.sectionKey);
            }}
          >
            {ctaLabel(section, canMutate, t)}
            <ArrowRight className="size-3.5" strokeWidth={1.25} aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function footerCopy(
  section: SpaceContextSectionRecord,
  t: ReturnType<typeof useTranslations<'SpaceContext'>>,
): string {
  if (section.status === 'ratified') {
    return t('card.ratifiedMeta', {
      agreement:
        section.ratifiedDocumentId ?? section.proposalDocumentId ?? '—',
    });
  }
  if (section.status === 'proposed') {
    return t('card.proposedMeta', {
      title: section.proposalTitle ?? t('card.proposalFallback'),
    });
  }
  if (section.status === 'draft') {
    if (section.contributorCount > 0) {
      return t('card.draftContributors', { count: section.contributorCount });
    }
    if (section.lastEditorName) {
      return t('card.draftEditor', { name: section.lastEditorName });
    }
    return t('card.draftMeta');
  }
  return '—';
}

function ctaLabel(
  section: SpaceContextSectionRecord,
  canMutate: boolean,
  t: ReturnType<typeof useTranslations<'SpaceContext'>>,
): string {
  if (section.status === 'proposed') return t('card.viewProposal');
  if (section.status === 'ratified') return t('card.view');
  if (!canMutate) return t('card.open');
  if (section.status === 'draft') return t('card.continue');
  return t('card.startWithAgent');
}

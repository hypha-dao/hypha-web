'use client';

import {
  headingForSectionKey,
  useProposalDetailsWeb3Rpc,
  type SpaceContextSectionRecord,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo } from 'react';
import { getProposalPath } from '../../common/get-path-function';
import { agreementNumber } from './agreement-number';

const RECENT_PASS_MS = 14 * 24 * 60 * 60 * 1000;

/** The most recently ratified agreement, while it is still news. */
function latestRatifiedGroup(sections: SpaceContextSectionRecord[]) {
  const now = Date.now();
  let latest: SpaceContextSectionRecord | null = null;
  for (const section of sections) {
    if (section.status !== 'ratified' || section.ratifiedDocumentId == null) {
      continue;
    }
    const at = section.ratifiedAt ? Date.parse(section.ratifiedAt) : NaN;
    if (!Number.isFinite(at) || now - at > RECENT_PASS_MS) continue;
    if (!latest || at > Date.parse(latest.ratifiedAt ?? '')) latest = section;
  }
  if (!latest) return null;
  const documentId = latest.ratifiedDocumentId;
  return {
    lead: latest,
    sections: sections.filter(
      (section) =>
        section.status === 'ratified' &&
        section.ratifiedDocumentId === documentId,
    ),
  };
}

export function SpaceContextPassedBanner({
  spaceSlug,
  sections,
}: {
  spaceSlug: string;
  sections: SpaceContextSectionRecord[];
}) {
  const t = useTranslations('SpaceContext');
  const locale = useLocale() as Locale;
  const group = useMemo(() => latestRatifiedGroup(sections), [sections]);
  const documentId = group?.lead.ratifiedDocumentId ?? null;

  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: group?.lead.ratifiedWeb3Id ?? null,
  });

  if (!group || documentId == null) return null;

  const agreement = agreementNumber(group.lead.ratifiedWeb3Id, documentId);
  const title =
    group.lead.ratifiedTitle ??
    t('proposeForm.title', {
      sections: group.sections
        .map((section) => headingForSectionKey(section.sectionKey))
        .join(', '),
    });
  const href = group.lead.ratifiedSlug
    ? getProposalPath(locale, spaceSlug, group.lead.ratifiedSlug)
    : null;

  return (
    <div
      role="status"
      className="flex flex-col gap-2 border border-success-11 bg-success-3 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <p className="flex min-w-0 items-start gap-2.5 text-1 font-medium text-foreground">
        <span
          className="text-[13px] font-bold leading-4 text-success-11"
          aria-hidden
        >
          ✓
        </span>
        <span>
          {proposalDetails
            ? t('passed.withVotes', {
                agreement,
                title,
                yes: Math.round(proposalDetails.unityPercentage),
                quorum: Math.round(proposalDetails.quorumPercentage),
              })
            : t('passed.plain', { agreement, title })}
        </span>
      </p>
      {href ? (
        <Link
          href={href}
          scroll={false}
          className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {t('passed.viewAgreement')} <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}

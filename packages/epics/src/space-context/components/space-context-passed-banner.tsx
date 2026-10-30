'use client';

import {
  headingForSectionKey,
  useProposalDetailsWeb3Rpc,
  type SpaceContextSectionRecord,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { ArrowRight, Check, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getProposalPath } from '../../common/get-path-function';
import { agreementNumber } from './agreement-number';

const RECENT_PASS_MS = 14 * 24 * 60 * 60 * 1000;

function dismissKey(spaceSlug: string, documentId: number) {
  return `hypha:space-context:passed:${spaceSlug}:${documentId}`;
}

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
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (documentId == null) return;
    try {
      setDismissed(
        window.localStorage.getItem(dismissKey(spaceSlug, documentId)) === '1',
      );
    } catch {
      setDismissed(false);
    }
  }, [documentId, spaceSlug]);

  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: group && !dismissed ? group.lead.ratifiedWeb3Id : null,
  });

  if (!group || documentId == null || dismissed) return null;

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

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(dismissKey(spaceSlug, documentId), '1');
    } catch {
      // Private mode: the banner simply returns on the next visit.
    }
  };

  return (
    <div
      role="status"
      className="flex flex-col gap-3 border border-success-8 bg-success-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex min-w-0 items-start gap-2 text-2 text-success-11">
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
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
      <div className="flex shrink-0 items-center gap-1">
        {href ? (
          <Button
            asChild
            variant="ghost"
            colorVariant="neutral"
            className="h-9 gap-1.5 px-3 uppercase tracking-[0.12em] text-success-11"
          >
            <Link href={href} scroll={false}>
              {t('passed.viewAgreement')}
              <ArrowRight className="size-3.5" strokeWidth={1.25} aria-hidden />
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          colorVariant="neutral"
          className="size-9 p-0 text-success-11"
          aria-label={t('passed.dismiss')}
          onClick={dismiss}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

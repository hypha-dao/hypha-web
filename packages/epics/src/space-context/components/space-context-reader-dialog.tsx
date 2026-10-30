'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  isProposableSection,
  officialSectionMarkdown,
  stripMatchingLeadingHeading,
  type BuiltinSpaceContextSectionKey,
  type SpaceContextSectionKey,
  type SpaceContextSectionRecord,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { MemoryProse } from '../../coherence/components/memory-prose';
import { getProposalPath } from '../../common/get-path-function';
import {
  discardSpaceContextSuggestionRequest,
  setSpaceContextRemovalSuggestedRequest,
} from '../hooks/use-space-context';
import { agreementNumber } from './agreement-number';
import { sectionNotice } from './space-context-card';
import {
  SpaceContextChangeBadge,
  SpaceContextStatusChip,
} from './space-context-status-chip';

export function SpaceContextReaderDialog({
  section,
  spaceSlug,
  canMutate,
  onClose,
  onOpenDiscussion,
  onPropose,
  onChanged,
}: {
  section: SpaceContextSectionRecord | null;
  spaceSlug: string;
  canMutate: boolean;
  onClose: () => void;
  onOpenDiscussion: (key: SpaceContextSectionKey) => void;
  onPropose: (keys: SpaceContextSectionKey[]) => void;
  onChanged?: (message: string) => void | Promise<void>;
}) {
  return (
    <Dialog
      open={section != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {section ? (
        <DialogContent className="w-[min(48rem,calc(100vw-var(--sidebar-left-width,0px)-var(--sidebar-right-width,0px)-2rem))] gap-5 p-0">
          <ReaderBody
            section={section}
            spaceSlug={spaceSlug}
            canMutate={canMutate}
            onClose={onClose}
            onOpenDiscussion={onOpenDiscussion}
            onPropose={onPropose}
            onChanged={onChanged}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function ReaderBody({
  section,
  spaceSlug,
  canMutate,
  onClose,
  onOpenDiscussion,
  onPropose,
  onChanged,
}: {
  section: SpaceContextSectionRecord;
  spaceSlug: string;
  canMutate: boolean;
  onClose: () => void;
  onOpenDiscussion: (key: SpaceContextSectionKey) => void;
  onPropose: (keys: SpaceContextSectionKey[]) => void;
  onChanged?: (message: string) => void | Promise<void>;
}) {
  const t = useTranslations('SpaceContext');
  const locale = useLocale() as Locale;
  const { getAccessToken } = useAuthentication();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const official = officialSectionMarkdown(section);
  const officialBody = official
    ? stripMatchingLeadingHeading(official, section.title)
    : '';
  const draftBody = stripMatchingLeadingHeading(
    section.markdown,
    section.title,
  );
  const showDraft =
    !!draftBody.trim() &&
    (official == null ||
      section.hasDraftChanges ||
      section.status === 'proposed');
  const draftShownAsProposed = section.status === 'proposed';
  const notice = sectionNotice(section, t);
  const onVoting = section.status === 'proposed';
  const proposalHref =
    onVoting && section.proposalSlug
      ? getProposalPath(locale, spaceSlug, section.proposalSlug)
      : null;
  const agreementHref = section.ratifiedSlug
    ? getProposalPath(locale, spaceSlug, section.ratifiedSlug)
    : null;
  const canSuggestRemoval =
    canMutate && !onVoting && section.pendingChange !== 'add';
  const canWithdrawAddition =
    canMutate && !onVoting && section.pendingChange === 'add';

  const run = async (action: () => Promise<unknown>, message: string) => {
    setActionError(null);
    setBusy(true);
    try {
      await action();
      await onChanged?.(message);
      return true;
    } catch {
      setActionError(t('error.change'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleRemoval = () =>
    run(
      () =>
        setSpaceContextRemovalSuggestedRequest({
          spaceSlug,
          sectionKey: section.sectionKey,
          suggested: section.pendingChange !== 'remove',
          getAccessToken,
        }),
      section.pendingChange === 'remove'
        ? t('success.removalWithdrawn')
        : t('success.removalSuggested'),
    );

  const withdrawAddition = async () => {
    const done = await run(
      () =>
        discardSpaceContextSuggestionRequest({
          spaceSlug,
          sectionKey: section.sectionKey,
          getAccessToken,
        }),
      t('success.additionWithdrawn'),
    );
    if (done) onClose();
  };

  return (
    <>
      <DialogHeader className="space-y-2 border-b border-border/70 px-6 pb-4 pt-6 pr-12 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <SpaceContextStatusChip status={section.status} />
          <SpaceContextChangeBadge change={section.pendingChange} />
        </div>
        <DialogTitle className="text-5 font-semibold">
          {section.title}
        </DialogTitle>
        <DialogDescription className="text-2 text-neutral-11">
          {section.isCustom
            ? t('reader.customLead')
            : t(`leads.${section.sectionKey as BuiltinSpaceContextSectionKey}`)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 px-6">
        {notice ? (
          <p className="border border-dashed border-neutral-6 px-3 py-2 text-1 text-neutral-11">
            {notice}
          </p>
        ) : null}

        <ReaderBlock
          label={t('reader.official')}
          meta={
            official != null && section.ratifiedDocumentId != null ? (
              <AgreementLink
                href={agreementHref}
                label={t('card.agreementRef', {
                  agreement: agreementNumber(
                    section.ratifiedWeb3Id,
                    section.ratifiedDocumentId,
                  ),
                })}
              />
            ) : null
          }
        >
          {officialBody.trim() ? (
            <MemoryProse
              source={officialBody}
              className="text-2 leading-relaxed text-foreground"
            />
          ) : (
            <p className="text-2 text-neutral-11">{t('reader.noOfficial')}</p>
          )}
        </ReaderBlock>

        {showDraft ? (
          <ReaderBlock
            label={
              draftShownAsProposed ? t('reader.proposed') : t('reader.draft')
            }
            meta={
              proposalHref ? (
                <AgreementLink
                  href={proposalHref}
                  label={t('card.viewProposal')}
                />
              ) : null
            }
            unofficial
          >
            <MemoryProse
              source={draftBody}
              className="text-2 leading-relaxed text-neutral-11"
            />
          </ReaderBlock>
        ) : null}

        {actionError ? (
          <p className="text-2 text-error-11" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>

      <DialogFooter className="flex flex-col-reverse gap-2 border-t border-border/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
        <div className="flex flex-wrap gap-2">
          {canSuggestRemoval ? (
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              disabled={busy}
              onClick={() => void toggleRemoval()}
            >
              {section.pendingChange === 'remove'
                ? t('reader.cancelRemoval')
                : t('reader.suggestRemoval')}
            </Button>
          ) : null}
          {canWithdrawAddition ? (
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              disabled={busy}
              onClick={() => void withdrawAddition()}
            >
              {t('reader.withdrawAddition')}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" colorVariant="neutral">
              {t('reader.close')}
            </Button>
          </DialogClose>
          {canMutate && isProposableSection(section) ? (
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              disabled={busy}
              onClick={() => onPropose([section.sectionKey])}
            >
              {t('propose')}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={busy}
            onClick={() => onOpenDiscussion(section.sectionKey)}
          >
            {t('card.openDiscussion')}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

function ReaderBlock({
  label,
  meta,
  unofficial,
  children,
}: {
  label: string;
  meta?: ReactNode;
  unofficial?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'space-y-3',
        unofficial && 'border border-dashed border-neutral-6 px-4 py-3',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-11">
          {label}
        </h3>
        {meta ? <span className="text-[11px]">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function AgreementLink({
  href,
  label,
}: {
  href: string | null;
  label: string;
}) {
  if (!href) return <span className="text-neutral-11">{label}</span>;
  return (
    <Link
      href={href}
      scroll={false}
      className="font-semibold text-foreground underline-offset-2 hover:underline"
    >
      {label}
    </Link>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  signalListUpvoteSummaryState,
  useCoherenceMutationsWeb2Rsc,
  useFindCoherences,
  useJwt,
  useMe,
  usePersonById,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button, MarkdownSuspense, Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import { shouldCloseSignalDetailChat } from '../lib/signal-detail-chat';
import { PersonAvatar } from '../../people/components/person-avatar';
import { useSignalCreatorMeta } from '../hooks/use-signal-creator-meta';
import { signalOriginLabel } from '../lib/signal-origin-label';
import { useSignalRoomActivity } from '../hooks/use-signal-room-activity';
import { useSignalSpaceMembership } from '../hooks/use-is-signal-space-non-member';
import {
  signalVotingSpaceId,
  useSignalVotingMode,
} from '../hooks/use-signal-voting-mode';
import { useCanUpdateSignalTasks } from '../hooks/use-can-update-signal-tasks';
import { SignalDomainControl } from './signal-domain';
import { prepareSignalDescriptionMarkdown } from '../utils/signal-description-markdown';
import { splitSignalMedia } from '../utils/signal-media';
import { signalDiscussionCount } from '../utils/signal-room-replies';
import { resolveSignalVideo } from '../utils/signal-video';
import { SignalCreatorActions } from './signal-creator-actions';
import { useSignalShortDate } from './signal-feed-row';
import { SignalTagBadges } from './signal-tag-badges';
import { SignalTypeBadge } from './signal-type-badge';
import { legacySignalFieldsToShow } from './legacy-signal-fields/legacy-signal-fields';
import {
  PRIORITY_DOT_MARK_CLASS,
  priorityDotClass,
} from '../utils/signal-priority-styles';
import { SignalUpvoteButton } from './signal-upvote-button';
import { useVoteEnabled } from '../../common/action-capabilities';
import { SignalVideoPlayer } from './signal-video-player';
import { LegacySignalFieldsDetail } from './legacy-signal-fields/legacy-signal-fields-detail';

/**
 * Column gap for Created by / Created / Last reply / Discussion.
 * 64px floor, 8% of the viewport, 112px cap. List cards keep the smaller
 * clamp in `signal-feed-row.tsx`.
 *
 * Columns keep their text width. The row wraps instead of ellipsizing a
 * label or a value. Open discussion uses `ml-auto`, so it stays at the
 * right end of whichever line it lands on.
 *
 * The section is padded like a list card (`p-4`); the body adds the rest
 * of the 24px inset.
 */
export const SIGNAL_PAGE_META_ROW_CLASS =
  'm-0 flex w-full min-w-0 flex-wrap items-start gap-y-4 border-t border-border/70 pt-4 gap-x-[clamp(64px,8vw,112px)]';

export const SIGNAL_PAGE_CARD_CLASS =
  'craft-card @container flex min-w-0 flex-col p-4';

export const SIGNAL_PAGE_CARD_BODY_CLASS =
  'flex min-w-0 w-full flex-col gap-5 p-2';

export const SIGNAL_PAGE_META_ITEM_CLASS =
  'flex max-w-full shrink-0 flex-col gap-1';

function fileExtension(name: string, url: string): string {
  const source = name.includes('.') ? name : url.split('?')[0] ?? '';
  const ext = source.split('.').pop()?.trim() ?? '';
  return ext && ext.length <= 5 ? ext.toUpperCase() : 'DOC';
}

type MarkdownComponents = NonNullable<
  React.ComponentProps<typeof MarkdownSuspense>['components']
>;
type MarkdownChildren = { children?: React.ReactNode };

/** Body sized to sit with the page meta: 14px text, headings a step or two up. */
const SIGNAL_DESCRIPTION_COMPONENTS: MarkdownComponents = {
  h1: ({ children }: MarkdownChildren) => (
    <h1 className="mb-1.5 mt-4 text-4 font-semibold text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }: MarkdownChildren) => (
    <h2 className="mb-1.5 mt-4 text-3 font-semibold text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: MarkdownChildren) => (
    <h3 className="mb-1 mt-3 text-2 font-semibold text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }: MarkdownChildren) => (
    <h4 className="mb-1 mt-3 text-2 font-semibold text-foreground first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }: MarkdownChildren) => (
    <p className="my-2 text-2 leading-relaxed text-foreground first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }: MarkdownChildren) => (
    <ul className="my-2 ml-0 list-outside list-disc pl-4 text-2 leading-relaxed text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }: MarkdownChildren) => (
    <ol className="my-2 ml-0 list-outside list-decimal pl-4 text-2 leading-relaxed text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }: MarkdownChildren) => (
    <li className="my-0.5">{children}</li>
  ),
  blockquote: ({ children }: MarkdownChildren) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-2 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  strong: ({ children }: MarkdownChildren) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: MarkdownChildren) => (
    <em className="italic">{children}</em>
  ),
  u: ({ children }: MarkdownChildren) => (
    <u className="underline">{children}</u>
  ),
};

function SignalDescriptionFallback() {
  return (
    <div className="flex flex-col gap-2" aria-busy>
      <Skeleton loading className="h-3.5 w-full rounded-none" />
      <Skeleton loading className="h-3.5 w-11/12 rounded-none" />
      <Skeleton loading className="h-3.5 w-2/3 rounded-none" />
    </div>
  );
}

/**
 * The markdown renderer suspends whenever it renders, so the body must not
 * re-render with the page: chat activity and list refreshes would flash the
 * fallback over a description that did not change.
 */
const SignalDescriptionBody = React.memo(function SignalDescriptionBody({
  source,
}: {
  source: string;
}) {
  const markdown = React.useMemo(
    () => prepareSignalDescriptionMarkdown(source),
    [source],
  );
  return (
    <MarkdownSuspense
      components={SIGNAL_DESCRIPTION_COMPONENTS}
      FallBack={<SignalDescriptionFallback />}
    >
      {markdown}
    </MarkdownSuspense>
  );
});

export type SignalPageProps = {
  lang: Locale;
  spaceSlug: string;
  signalSlug: string;
  humanChatEnabled?: boolean;
  /**
   * Display only: no upvote, no creator actions (edit, delete) and no write on
   * mount (the assignment acknowledgement). Default off, so the main app is
   * unchanged.
   */
  readOnly?: boolean;
};

export function SignalPage({
  lang,
  spaceSlug,
  signalSlug,
  humanChatEnabled = false,
  readOnly = false,
}: SignalPageProps) {
  const t = useTranslations('CoherenceTab');
  const shortDate = useSignalShortDate();

  const { space } = useSpaceBySlug(spaceSlug);
  const {
    votingMode,
    status: votingModeStatus,
    retry: retryVotingMode,
  } = useSignalVotingMode(signalVotingSpaceId(space));
  const { isNonMember, isMembershipPending } = useSignalSpaceMembership(space);
  const { canUpdateTasks } = useCanUpdateSignalTasks({
    spaceSlug,
    web3SpaceId: space?.web3SpaceId ?? undefined,
  });
  const {
    coherences,
    isLoading: isSignalsLoading,
    error: signalsError,
    refresh,
  } = useFindCoherences({
    spaceSlug,
    includeArchived: true,
    orderBy: 'mostupvoted',
  });
  const signal = React.useMemo(
    () => coherences?.find((item) => item.slug?.trim() === signalSlug) ?? null,
    [coherences, signalSlug],
  );

  const activityRooms = React.useMemo(() => (signal ? [signal] : []), [signal]);
  const activity = useSignalRoomActivity(activityRooms)[signal?.roomId ?? ''];
  const { creatorDisplayName, relaySourceLabel } = useSignalCreatorMeta({
    creatorId: signal?.creatorId ?? null,
    createdAt: signal?.createdAt ?? new Date(0),
    description: signal?.description ?? '',
    title: signal?.title ?? '',
    tags: signal?.tags ?? [],
    origin: signal?.origin,
  });
  const originLabel = signalOriginLabel(signal?.origin, t, {
    relaySourceLabel,
  });
  const { person: creator } = usePersonById({ id: signal?.creatorId });

  const {
    mode: chatMode,
    coherenceSlug: chatSlug,
    openCoherenceChat,
    closeCoherenceChat,
    closeHumanChatPanel,
  } = useHumanChatPanel();
  const openChat = React.useCallback(() => {
    if (!signal?.slug) return;
    openCoherenceChat(
      signal.roomId ?? null,
      signal.title ?? '',
      signal.slug,
      signal.description ?? null,
      spaceSlug,
    );
  }, [openCoherenceChat, signal, spaceSlug]);

  const openedDiscussionSlug = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!humanChatEnabled || !signal?.slug) return;
    if (openedDiscussionSlug.current === signal.slug) return;
    openedDiscussionSlug.current = signal.slug;
    openChat();
  }, [humanChatEnabled, openChat, signal?.slug]);

  const signalChatRef = React.useRef({
    mode: chatMode,
    slug: chatSlug,
    closeCoherenceChat,
    closeHumanChatPanel,
  });
  signalChatRef.current = {
    mode: chatMode,
    slug: chatSlug,
    closeCoherenceChat,
    closeHumanChatPanel,
  };
  const closeOpenedSignalChat = React.useCallback(() => {
    const current = signalChatRef.current;
    if (
      !shouldCloseSignalDetailChat({
        mode: current.mode,
        chatSlug: current.slug,
        signalSlug,
      })
    ) {
      return;
    }
    current.closeCoherenceChat();
    current.closeHumanChatPanel();
  }, [signalSlug]);
  // Close before paint so the feed does not keep this signal's chat open.
  // Browser back unmounts the page without the breadcrumb click.
  React.useLayoutEffect(() => {
    return () => {
      closeOpenedSignalChat();
    };
  }, [closeOpenedSignalChat]);

  const { person } = useMe();
  const voteEnabled = useVoteEnabled();
  // Display-only, except where this delivery can vote (host with login).
  const canUpvote = !readOnly || voteEnabled;
  const { jwt } = useJwt();
  const { acknowledgeCoherenceAssignment } = useCoherenceMutationsWeb2Rsc(jwt);
  const acknowledgedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (readOnly) return;
    const slug = signal?.slug?.trim();
    if (!slug || !person?.id || !jwt) return;
    const assignees = Array.isArray(signal?.assigneeIds)
      ? signal.assigneeIds
      : [];
    if (!assignees.includes(person.id)) return;
    if (signal?.assigneeAcknowledgedAt?.[String(person.id)]) return;
    if (acknowledgedRef.current === slug) return;
    acknowledgedRef.current = slug;
    void acknowledgeCoherenceAssignment({ slug }).catch((error: unknown) => {
      acknowledgedRef.current = null;
      console.warn('Could not acknowledge signal assignment:', error);
    });
  }, [acknowledgeCoherenceAssignment, jwt, person?.id, readOnly, signal]);

  const [isRetrying, setIsRetrying] = React.useState(false);
  const retryLoad = React.useCallback(async () => {
    setIsRetrying(true);
    try {
      await refresh();
    } catch {
      // The SWR error state already drives the retry notice.
    } finally {
      setIsRetrying(false);
    }
  }, [refresh]);

  const feedHref = `/${lang}/dho/${spaceSlug}/coherence`;
  if (!signal) {
    if (isSignalsLoading) {
      return (
        <div className="flex flex-col gap-4" aria-busy>
          <Skeleton loading className="h-4 w-48 rounded-none" />
          <Skeleton loading className="h-48 w-full rounded-none" />
          <Skeleton loading className="h-32 w-full rounded-none" />
        </div>
      );
    }
    if (signalsError) {
      return (
        <div
          role="alert"
          className="craft-card flex flex-col items-center gap-3 px-4 py-8 text-center"
        >
          <p className="m-0 text-1 text-muted-foreground">
            {t('signalLoadFailed')}
          </p>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            size="sm"
            disabled={isRetrying}
            onClick={() => void retryLoad()}
          >
            {t('signalLoadRetry')}
          </Button>
        </div>
      );
    }
    return (
      <p className="craft-card px-4 py-8 text-center text-1 text-muted-foreground">
        {t('signalNotFound')}
      </p>
    );
  }

  const created = shortDate(signal.createdAt);
  const comments = signalDiscussionCount(signal.messages, activity);
  const discussion = t('signalCommentsCount', { count: comments });
  const description = signal.description?.trim() ?? '';
  const byline = [creatorDisplayName, created, discussion]
    .filter(Boolean)
    .join(' · ');
  const { images, documents } = splitSignalMedia(signal);
  const video = resolveSignalVideo(signal.videoUrl);
  const leadImage = images[0] ?? null;
  const moreImages = images.slice(1);
  const hasRightMedia = Boolean(leadImage || video || moreImages.length);
  const legacy = legacySignalFieldsToShow(signal);
  const priority = legacy?.priority ?? null;
  const priorityLabel = priority
    ? t.has(`priorities.${priority}` as never)
      ? t(`priorities.${priority}` as never)
      : priority
    : null;
  const tags = legacy?.tags ?? [];
  const upvoteSummary = signalListUpvoteSummaryState({
    hasSettledList: Boolean(coherences),
    isLoading: isSignalsLoading,
    hasError: signalsError != null,
  });

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-6 py-2"
      data-testid="signal-page"
      data-member-signal-detail=""
    >
      <nav aria-label={t('signals')}>
        <Link
          href={feedHref}
          className="inline-flex items-center gap-1.5 text-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="craft-icon" aria-hidden />
          {t('signals')}
        </Link>
      </nav>

      {signalsError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border border-error-6 bg-error-2 px-3 py-2 text-1 text-error-11"
        >
          <span>{t('signalLoadFailed')}</span>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            size="sm"
            disabled={isRetrying}
            onClick={() => void retryLoad()}
          >
            {t('signalLoadRetry')}
          </Button>
        </div>
      ) : null}

      <article
        className={cn(
          'grid min-w-0 gap-8',
          hasRightMedia &&
            'lg:grid-cols-[minmax(0,1fr)_minmax(14rem,22rem)] lg:items-start',
        )}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <header className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SignalTypeBadge type={signal.type} variant="pill" />
                <SignalDomainControl
                  spaceSlug={spaceSlug}
                  signalSlug={signal.slug}
                  board={signal.board}
                  editable={!readOnly && canUpdateTasks}
                  refresh={refresh}
                />
                {priority && priorityLabel ? (
                  <span className="inline-flex items-center gap-1.5 text-1 text-muted-foreground">
                    <span
                      className={cn(
                        PRIORITY_DOT_MARK_CLASS,
                        priorityDotClass(priority),
                      )}
                      aria-hidden
                    />
                    <span className="sr-only">{t('priority')}: </span>
                    {priorityLabel}
                  </span>
                ) : null}
              </div>
              {readOnly ? null : (
                <SignalCreatorActions
                  lang={lang}
                  spaceSlug={spaceSlug}
                  slug={signal.slug ?? ''}
                  creatorId={signal.creatorId}
                  className="flex items-center gap-2"
                />
              )}
            </div>
            <h1 className="m-0 text-balance text-[22px] font-medium leading-[1.2] tracking-[-0.02em] text-foreground [font-family:var(--font-family-heading)] sm:text-[24px]">
              {signal.title}
            </h1>
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-1 text-muted-foreground">
              <PersonAvatar
                size="sm"
                shape="circle"
                avatarSrc={creator?.avatarUrl ?? ''}
                userName={creatorDisplayName ?? undefined}
                personId={signal.creatorId ?? undefined}
              />
              <p className="m-0 min-w-0 break-words">{byline}</p>
            </div>
            {originLabel ? (
              <p
                className="m-0 text-1 text-muted-foreground"
                data-testid="signal-page-origin"
              >
                {originLabel}
              </p>
            ) : null}
            {tags.length > 0 ? (
              <SignalTagBadges
                tags={tags}
                maxVisible={tags.length}
                showHashPrefix={false}
              />
            ) : null}
          </header>

          <div className="flex flex-wrap items-center gap-2">
            {!canUpvote ? null : (
              <SignalUpvoteButton
                slug={signal.slug}
                spaceSlug={spaceSlug}
                upvotes={signal.upvotes}
                votingMode={votingMode}
                votingModeStatus={votingModeStatus}
                onRetryVotingMode={retryVotingMode}
                isNonMember={isNonMember}
                isMembershipPending={isMembershipPending}
                refresh={refresh}
                archived={signal.archived}
                variant="page"
                summaryState={upvoteSummary}
                layout="row"
                className="shrink-0"
              />
            )}
            {humanChatEnabled ? (
              <button
                type="button"
                data-testid="signal-open-discussion"
                onClick={openChat}
                className="box-border inline-flex h-[36px] min-h-[36px] shrink-0 items-center gap-1.5 border border-border bg-transparent px-3 text-1 font-medium leading-none text-foreground hover:bg-foreground/5"
              >
                {t('openDiscussion')}
                <span aria-hidden>→</span>
              </button>
            ) : null}
          </div>

          {description ? (
            <div className="text-2 text-foreground/90 [&_strong]:font-semibold [&_strong]:text-foreground">
              <SignalDescriptionBody source={description} />
            </div>
          ) : null}

          {documents.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-2 border-t border-border/70 p-0 pt-5">
              {documents.map((doc) => (
                <li
                  key={doc.url}
                  className="flex items-center gap-3 border border-border/70 px-3 py-2"
                >
                  <span className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    {fileExtension(doc.name, doc.url)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-1 text-foreground">
                    {doc.name}
                  </span>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex shrink-0 items-center gap-1 text-1 text-muted-foreground hover:text-foreground"
                  >
                    {t('signalDownload')}
                    <Download className="craft-icon-sm" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {hasRightMedia ? (
          <aside className="flex min-w-0 flex-col gap-3">
            {leadImage ? (
              <a
                href={leadImage.url}
                target="_blank"
                rel="noreferrer"
                className="block w-full overflow-hidden border border-border/70"
              >
                <img
                  src={leadImage.url}
                  alt={leadImage.name}
                  className="aspect-[4/3] w-full object-cover"
                />
              </a>
            ) : null}
            {video ? (
              <div className="w-full overflow-hidden border border-border/70 bg-black">
                <div className="relative aspect-video w-full">
                  <SignalVideoPlayer video={video} title={signal.title} />
                </div>
              </div>
            ) : null}
            {moreImages.map((image) => (
              <a
                key={image.url}
                href={image.url}
                target="_blank"
                rel="noreferrer"
                className="block w-full overflow-hidden border border-border/70"
              >
                <img
                  src={image.url}
                  alt={image.name}
                  className="aspect-[4/3] w-full object-cover"
                />
              </a>
            ))}
          </aside>
        ) : null}
      </article>

      {/* TODO: Temporary for Reciprocal Exchange. Delete with legacy-signal-fields/. */}
      <LegacySignalFieldsDetail signal={signal} />
    </div>
  );
}

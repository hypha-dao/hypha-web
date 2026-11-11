'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import {
  signalListUpvoteSummaryState,
  type Coherence,
  useCoherenceMutationsWeb2Rsc,
  useFindCoherences,
  useJwt,
  useMatrix,
  useMe,
  usePeopleBySubs,
  usePersonById,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button, MarkdownSuspense, Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import { shouldCloseSignalDetailChat } from '../lib/signal-detail-chat';
import { matrixUserIdToCanonicalPrivySub } from '../../common/human-chat-panel/matrix-room-member-display';
import { PersonAvatar } from '../../people/components/person-avatar';
import { useSignalCreatorMeta } from '../hooks/use-signal-creator-meta';
import { useSignalRoomActivity } from '../hooks/use-signal-room-activity';
import { useSignalSpaceMembership } from '../hooks/use-is-signal-space-non-member';
import {
  signalVotingSpaceId,
  useSignalVotingMode,
} from '../hooks/use-signal-voting-mode';
import { countSignalMedia, splitSignalMedia } from '../utils/signal-media';
import { signalLastReplierLabel } from '../utils/signal-room-replies';
import { resolveSignalVideo } from '../utils/signal-video';
import { SignalCreatorActions } from './signal-creator-actions';
import { useSignalMediaSummary } from './signal-media-chips';
import { useSignalShortDate } from './signal-feed-row';
import { SignalTypeBadge } from './signal-type-badge';
import { SignalUpvoteButton } from './signal-upvote-button';
import { SignalVideoPlayer } from './signal-video-player';

const SECTION_LABEL_CLASS =
  'text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground';

function fileExtension(name: string, url: string): string {
  const source = name.includes('.') ? name : url.split('?')[0] ?? '';
  const ext = source.split('.').pop()?.trim() ?? '';
  return ext && ext.length <= 5 ? ext.toUpperCase() : 'DOC';
}

function MetaItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className={SECTION_LABEL_CLASS}>{label}</dt>
      <dd className="m-0 flex min-w-0 items-center gap-2 text-1 text-foreground">
        {children}
      </dd>
    </div>
  );
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
  return (
    <MarkdownSuspense
      components={SIGNAL_DESCRIPTION_COMPONENTS}
      FallBack={<SignalDescriptionFallback />}
    >
      {source}
    </MarkdownSuspense>
  );
});

function SignalMediaSection({ signal }: { signal: Coherence }) {
  const t = useTranslations('CoherenceTab');
  const { images, documents } = React.useMemo(
    () => splitSignalMedia(signal),
    [signal],
  );
  const video = React.useMemo(
    () => resolveSignalVideo(signal.videoUrl),
    [signal.videoUrl],
  );
  const galleryCount = images.length + (video ? 1 : 0);
  if (galleryCount === 0 && documents.length === 0) return null;

  return (
    <section className="craft-card flex flex-col gap-4 p-5">
      <h2 className={cn(SECTION_LABEL_CLASS, 'm-0')}>
        {t('signalMedia')} · {galleryCount + documents.length}
      </h2>
      {galleryCount > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {video ? (
            <figure className="m-0 flex flex-col gap-1.5 sm:col-span-2">
              <div className="relative aspect-video w-full overflow-hidden bg-black">
                <SignalVideoPlayer video={video} title={signal.title} />
              </div>
            </figure>
          ) : null}
          {images.map((image) => (
            <figure key={image.url} className="m-0 flex flex-col gap-1.5">
              <a
                href={image.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden border border-border/70 bg-background-3"
              >
                <img
                  src={image.url}
                  alt={image.name}
                  className="aspect-[4/3] w-full object-cover"
                />
              </a>
              <figcaption className="truncate text-1 text-muted-foreground">
                {image.name}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {documents.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {documents.map((doc) => (
            <li
              key={doc.url}
              className="flex items-center gap-3 border border-border/70 px-3 py-2.5"
            >
              <span className="grid h-8 min-w-10 place-items-center bg-foreground/5 px-1.5 text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
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
                className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground hover:text-accent-11"
              >
                {t('signalDownload')}
                <Download className="craft-icon-sm" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export type SignalPageProps = {
  lang: Locale;
  spaceSlug: string;
  signalSlug: string;
  humanChatEnabled?: boolean;
};

export function SignalPage({
  lang,
  spaceSlug,
  signalSlug,
  humanChatEnabled = false,
}: SignalPageProps) {
  const t = useTranslations('CoherenceTab');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const shortDate = useSignalShortDate();

  const { space } = useSpaceBySlug(spaceSlug);
  const {
    votingMode,
    status: votingModeStatus,
    retry: retryVotingMode,
  } = useSignalVotingMode(signalVotingSpaceId(space));
  const { isNonMember, isMembershipPending } = useSignalSpaceMembership(space);
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
  const { client: matrixClient } = useMatrix();
  const lastReplySub = activity?.lastReplySenderId
    ? matrixUserIdToCanonicalPrivySub(activity.lastReplySenderId)
    : null;
  const lastReplySubs = React.useMemo(
    () => (lastReplySub ? [lastReplySub] : []),
    [lastReplySub],
  );
  const { peopleBySub: lastReplyPeople } = usePeopleBySubs({
    subs: lastReplySubs,
  });
  const lastReplyPerson = lastReplySub
    ? lastReplyPeople.get(lastReplySub)
    : undefined;
  const { creatorDisplayName } = useSignalCreatorMeta({
    creatorId: signal?.creatorId ?? null,
    createdAt: signal?.createdAt ?? new Date(0),
    description: signal?.description ?? '',
    title: signal?.title ?? '',
    tags: signal?.tags ?? [],
  });
  const { person: creator } = usePersonById({ id: signal?.creatorId });
  const mediaSummary = useSignalMediaSummary(
    React.useMemo(() => countSignalMedia(signal ?? undefined), [signal]),
  );

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
  const { jwt } = useJwt();
  const { acknowledgeCoherenceAssignment } = useCoherenceMutationsWeb2Rsc(jwt);
  const acknowledgedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
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
  }, [acknowledgeCoherenceAssignment, jwt, person?.id, signal]);

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
  const storedComments = signal.messages ?? 0;
  const comments = activity
    ? activity.reachesRoomStart
      ? activity.comments
      : Math.max(activity.comments, storedComments)
    : storedComments;
  const fullName = (p?: { name?: string | null; surname?: string | null }) =>
    [p?.name, p?.surname].filter(Boolean).join(' ').trim();
  const lastReplierName = signalLastReplierLabel({
    senderId: activity?.lastReplySenderId,
    viewerMatrixId: matrixClient?.getUserId(),
    viewerName: fullName(person ?? undefined),
    personName:
      fullName(lastReplyPerson) || lastReplyPerson?.nickname?.trim() || null,
    matrixName: activity?.lastReplySenderName,
  });
  const lastReply =
    activity?.lastReplyAt != null
      ? [
          format.relativeTime(new Date(activity.lastReplyAt), now),
          lastReplierName,
        ]
          .filter(Boolean)
          .join(' · ')
      : activity?.reachesRoomStart
      ? t('signalNoReplies')
      : null;
  const discussion = [
    t('signalCommentsCount', { count: comments }),
    activity?.reachesRoomStart
      ? t('signalPeopleCount', { count: activity.people })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const description = signal.description?.trim() ?? '';

  return (
    <div className="flex flex-col gap-4" data-testid="signal-page">
      <nav
        aria-label={t('signals')}
        className="flex min-w-0 items-center gap-2 text-1 text-muted-foreground"
      >
        <Link
          href={feedHref}
          className="inline-flex shrink-0 items-center gap-1.5 hover:text-foreground"
        >
          <ArrowLeft className="craft-icon" aria-hidden />
          {t('signals')}
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate text-foreground">{signal.title}</span>
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

      <section className="craft-card flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <SignalTypeBadge type={signal.type} variant="box" />
            <h1 className="m-0 min-w-0 text-4 leading-tight text-foreground">
              {signal.title}
            </h1>
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
              summaryState={signalListUpvoteSummaryState({
                hasSettledList: Boolean(coherences),
                isLoading: isSignalsLoading,
                hasError: signalsError != null,
              })}
              className="self-start"
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
            <SignalCreatorActions
              lang={lang}
              spaceSlug={spaceSlug}
              slug={signal.slug ?? ''}
              creatorId={signal.creatorId}
              className="flex items-center gap-2"
            />
          </div>
        </div>

        <dl
          data-testid="signal-page-meta"
          className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/70 pt-4 lg:grid-cols-5"
        >
          <MetaItem label={t('signalCreatedBy')}>
            <PersonAvatar
              size="sm"
              shape="circle"
              avatarSrc={creator?.avatarUrl ?? ''}
              userName={creatorDisplayName ?? undefined}
              personId={signal.creatorId ?? undefined}
            />
            <span className="truncate">{creatorDisplayName}</span>
          </MetaItem>
          {created ? (
            <MetaItem label={t('signalCreatedLabel')}>{created}</MetaItem>
          ) : null}
          {lastReply ? (
            <MetaItem label={t('signalLastReplyLabel')}>
              <span className="truncate">{lastReply}</span>
            </MetaItem>
          ) : null}
          <div className="col-span-full flex min-w-0 items-end justify-between gap-3">
            <MetaItem label={t('signalDiscussion')}>
              <span className="truncate">{discussion}</span>
            </MetaItem>
            {humanChatEnabled ? (
              <button
                type="button"
                data-testid="signal-open-discussion"
                onClick={openChat}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-foreground underline-offset-2 hover:underline"
              >
                {t('openDiscussion')}
                <span aria-hidden>→</span>
              </button>
            ) : null}
          </div>
          {mediaSummary ? (
            <MetaItem label={t('signalAttachmentsLabel')}>
              <span className="truncate">{mediaSummary}</span>
            </MetaItem>
          ) : null}
        </dl>
      </section>

      {description ? (
        <section className="craft-card flex flex-col gap-3 p-5">
          <h2 className={cn(SECTION_LABEL_CLASS, 'm-0')}>{t('description')}</h2>
          <div className="text-2 leading-relaxed text-foreground">
            <SignalDescriptionBody source={description} />
          </div>
        </section>
      ) : null}

      <SignalMediaSection signal={signal} />
    </div>
  );
}

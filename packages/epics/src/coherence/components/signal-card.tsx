'use client';

import {
  Coherence,
  COHERENCE_PRIORITY_OPTIONS,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardTitle,
  Skeleton,
} from '@hypha-platform/ui';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Archive, ArchiveRestore, CalendarDays, Pencil } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';
import { resolveSignalPersonIds, SignalAssignee } from './signal-assignee';
import { SignalDescriptionButton } from './signal-description-dialog';
import { SignalTagBadges } from './signal-tag-badges';
import { SignalUpvoteControl } from './signal-upvote-control';
import {
  PRIORITY_LEFT_ACCENT_BAR_CLASS,
  priorityLeftBorderClass,
} from '../utils/signal-priority-styles';
import { signalCardActiveClass } from '../utils/signal-active-styles';
import { useParams, useRouter } from 'next/navigation';
import { useCanManageSignal } from '../hooks/use-can-manage-signal';

type SignalCardProps = {
  isLoading: boolean;
  refresh: () => Promise<void>;
  onOpenConversation?: () => void;
  className?: string;
  leadImage?: string;
  isActive?: boolean;
};

export const SignalCard: React.FC<SignalCardProps & Coherence> = ({
  isLoading,
  title,
  description,
  priority,
  slug,
  createdAt,
  tags,
  archived,
  messages = 0,
  roomId,
  creatorId,
  assigneeIds,
  upvotes,
  refresh,
  onOpenConversation,
  className,
  leadImage: _leadImage,
  isActive = false,
}) => {
  const { jwt: authToken } = useJwt();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const t = useTranslations('CoherenceTab');
  const tSignalCard = useTranslations('SignalCard');
  const router = useRouter();
  const params = useParams<{ lang: string; id: string; tab?: string }>();
  const { space: currentSpace } = useSpaceBySlug(params.id ?? '');
  const canManageSignal = useCanManageSignal({
    spaceSlug: params.id ?? '',
    web3SpaceId: currentSpace?.web3SpaceId ?? undefined,
  });
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();
  const locale = useLocale();
  const dateFnsLocale = React.useMemo(
    () => resolveDateFnsLocale(locale),
    [locale],
  );
  const createdAtDate = React.useMemo(() => {
    if (!createdAt) return null;
    const parsed = new Date(createdAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [createdAt]);
  const normalizedMessagesCount = React.useMemo(() => {
    const parsed =
      typeof messages === 'number'
        ? messages
        : Number.parseFloat(`${messages}`);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.trunc(parsed);
  }, [messages]);
  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);
  const [isArchiveMutating, setIsArchiveMutating] = React.useState(false);
  const [archiveError, setArchiveError] = React.useState<string | null>(null);

  const hasPersonSlot =
    resolveSignalPersonIds({
      assigneeIds,
      fallbackPersonId: creatorId,
    }).length > 0;
  const priorityMeta = React.useMemo(
    () => COHERENCE_PRIORITY_OPTIONS.find((o) => o.priority === priority),
    [priority],
  );

  const priorityLabel = React.useMemo(() => {
    if (!priorityMeta) return t('priorities.medium');
    const priorityKey = `priorities.${priorityMeta.priority}`;
    return t.has(priorityKey as never)
      ? t(priorityKey as never)
      : priorityMeta.priority;
  }, [priorityMeta, t]);

  const createdAtShort = React.useMemo(
    () =>
      createdAtDate
        ? formatDistanceToNowStrict(createdAtDate, {
            addSuffix: false,
            locale: dateFnsLocale,
          })
        : '',
    [createdAtDate, dateFnsLocale],
  );

  const handleToggleArchive = React.useCallback(async (): Promise<boolean> => {
    if (!slug || isArchiveMutating) return false;
    setArchiveError(null);
    setIsArchiveMutating(true);
    try {
      await updateCoherenceBySlug({ slug, archived: !archived });
      try {
        await refresh();
      } catch (refreshErr) {
        console.warn(
          'Signal archive state updated but refresh failed:',
          refreshErr,
        );
      }
      return true;
    } catch (error) {
      console.warn(
        archived ? 'Could not unarchive signal:' : 'Could not archive signal:',
        error,
      );
      setArchiveError(t('errorOhSnap'));
      return false;
    } finally {
      setIsArchiveMutating(false);
    }
  }, [archived, slug, isArchiveMutating, refresh, t, updateCoherenceBySlug]);

  const metaParts: Array<{ key: string; node: React.ReactNode }> = [];
  if (hasPersonSlot) {
    metaParts.push({
      key: 'assignee',
      node: (
        <SignalAssignee
          assigneeIds={assigneeIds}
          fallbackPersonId={creatorId}
          variant="meta"
          className="min-w-0 truncate"
        />
      ),
    });
  }
  if (createdAtShort) {
    metaParts.push({
      key: 'created',
      node: (
        <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
          <CalendarDays className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          {createdAtShort}
        </span>
      ),
    });
  }
  if (normalizedMessagesCount > 0) {
    metaParts.push({
      key: 'messages',
      node: (
        <span
          className="shrink-0 tabular-nums"
          aria-label={t('messageCount', { count: normalizedMessagesCount })}
        >
          {normalizedMessagesCount}
        </span>
      ),
    });
  }

  const stopCardActivationKey = React.useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
        }
        e.stopPropagation();
      }
    },
    [],
  );

  return (
    <Card
      className={cn(
        'craft-card-interactive group relative flex h-full w-full min-h-0 flex-col',
        signalCardActiveClass(isActive),
        className,
      )}
    >
      <div
        className={cn(
          PRIORITY_LEFT_ACCENT_BAR_CLASS,
          priorityLeftBorderClass(priority),
        )}
        title={priorityLabel}
        aria-label={priorityLabel}
      />
      <CardContent className="relative flex flex-1 flex-col gap-0 p-0">
        <div className="relative flex flex-1 flex-col gap-2.5 px-3.5 pb-3 pt-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Skeleton
                  className="min-w-0"
                  width="100%"
                  height="20px"
                  loading={isLoading}
                >
                  <CardTitle
                    className="line-clamp-3 text-2 font-medium leading-snug tracking-tight"
                    title={title}
                  >
                    {title}
                  </CardTitle>
                </Skeleton>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                <SignalDescriptionButton
                  title={title}
                  description={description}
                  size="md"
                />
                {canManageSignal && slug ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      colorVariant="neutral"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={isLoading}
                      aria-label={tSignalCard('editMenu')}
                      title={tSignalCard('editMenu')}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!params.lang || !params.id || !slug) return;
                        const tab = params.tab ?? 'coherence';
                        router.push(
                          `/${params.lang}/dho/${params.id}/${tab}/edit-signal/${slug}`,
                        );
                      }}
                      onKeyDown={stopCardActivationKey}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      colorVariant="neutral"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={isLoading || isArchiveMutating}
                      aria-label={
                        archived
                          ? t('unarchiveConversation')
                          : t('archiveConversation')
                      }
                      title={
                        archived
                          ? t('unarchiveConversation')
                          : t('archiveConversation')
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setArchiveDialogOpen(true);
                      }}
                      onKeyDown={stopCardActivationKey}
                    >
                      {archived ? (
                        <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Archive className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            {/* Priority stays on the left accent bar only — avoid duplicate
                status channel. Signal type is omitted: it repeated on every
                card without changing what anyone does next. */}
            {metaParts.length > 0 ? (
              <p className="flex min-w-0 items-center text-1 text-muted-foreground">
                {metaParts.map((part, index) => (
                  <React.Fragment key={part.key}>
                    {index > 0 ? (
                      <span className="mx-1.5 shrink-0 text-border" aria-hidden>
                        ·
                      </span>
                    ) : null}
                    {part.node}
                  </React.Fragment>
                ))}
              </p>
            ) : null}
          </div>

          {tags?.length > 0 ? (
            <SignalTagBadges
              tags={tags}
              maxVisible={2}
              showHashPrefix={false}
              className="content-start gap-1"
            />
          ) : null}
        </div>

        <div className="mt-auto flex shrink-0 items-center gap-2 border-t border-border/50 px-3.5 py-2">
          <SignalUpvoteControl
            slug={slug}
            upvotes={upvotes}
            refresh={refresh}
            disabled={isLoading || Boolean(archived)}
          />
          {onOpenConversation && !archived ? (
            <Button
              variant="ghost"
              colorVariant="neutral"
              size="sm"
              className="h-7 min-w-0 flex-1 justify-start px-2 text-muted-foreground hover:text-foreground"
              disabled={isLoading || !roomId}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenConversation();
              }}
              title={!roomId ? tSignalCard('noConversationRoom') : undefined}
            >
              <ChatBubbleIcon />
              <span className="truncate text-1">{t('openConversation')}</span>
            </Button>
          ) : null}
        </div>
        <AlertDialog
          open={archiveDialogOpen}
          onOpenChange={(open) => {
            if (isArchiveMutating) return;
            setArchiveDialogOpen(open);
            if (!open) setArchiveError(null);
          }}
        >
          <AlertDialogContent
            overlayClassName="bg-black/75 backdrop-blur-sm supports-[backdrop-filter]:bg-black/65"
            className="border-l-[3px] border-l-[var(--space-accent)]"
            style={spaceAccentPortalStyle}
            data-space-accent-scope=""
            onClick={(e) => e.stopPropagation()}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {archived
                  ? t('unarchiveConversation')
                  : t('archiveConversation')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {archived ? t('unarchiveConfirm') : t('archiveConfirm')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {archiveError ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {archiveError}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button
                  variant="outline"
                  colorVariant="neutral"
                  disabled={isArchiveMutating}
                  onKeyDown={stopCardActivationKey}
                >
                  {t('noLeave')}
                </Button>
              </AlertDialogCancel>
              <Button
                type="button"
                colorVariant="accent"
                disabled={isArchiveMutating}
                onClick={async (e) => {
                  e.stopPropagation();
                  const updated = await handleToggleArchive();
                  if (updated) setArchiveDialogOpen(false);
                }}
                onKeyDown={stopCardActivationKey}
              >
                {archived ? t('yesUnarchive') : t('yesArchive')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

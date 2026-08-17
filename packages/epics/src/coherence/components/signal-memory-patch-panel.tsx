'use client';

import { FC, useState } from 'react';
import { Text } from '@radix-ui/themes';
import { Button, Textarea } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useSignalIntelligencePatch } from '../hooks/use-signal-intelligence-patch';
import { useCanManageSignal } from '../hooks/use-can-manage-signal';
import { useSpaceBySlug } from '@hypha-platform/core/client';

type SignalMemoryPatchPanelProps = {
  spaceSlug: string;
  signalSlug: string;
  className?: string;
};

export const SignalMemoryPatchPanel: FC<SignalMemoryPatchPanelProps> = ({
  spaceSlug,
  signalSlug,
  className,
}) => {
  const t = useTranslations('CoherenceTab');
  const { space } = useSpaceBySlug(spaceSlug);
  const canManage = useCanManageSignal({
    spaceSlug,
    web3SpaceId: space?.web3SpaceId ?? undefined,
  });
  const {
    patch,
    configured,
    isLoading,
    error,
    actionError,
    isActing,
    approve,
    reject,
  } = useSignalIntelligencePatch(spaceSlug, signalSlug);

  const [editing, setEditing] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState('');

  if (isLoading) {
    return (
      <div className={className}>
        <Text className="text-2 text-muted-foreground">
          {t('signalMemoryPatchLoading')}
        </Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} role="alert">
        <Text className="text-2 text-destructive">{error}</Text>
      </div>
    );
  }

  if (!configured || !patch || patch.status !== 'pending') {
    return null;
  }

  const shortSha =
    patch.expected_sha.length > 12
      ? `${patch.expected_sha.slice(0, 12)}…`
      : patch.expected_sha;

  return (
    <section
      className={
        className ??
        'rounded-lg border border-border/70 bg-muted/10 p-4 dark:bg-muted/10 lg:p-6'
      }
      aria-label={t('signalMemoryPatchTitle')}
    >
      <header className="mb-3">
        <h3 className="text-3 font-medium text-foreground">
          {t('signalMemoryPatchTitle')}
        </h3>
        <p className="mt-1 text-2 text-muted-foreground">
          {t('signalMemoryPatchSubtitle')}
        </p>
      </header>

      <dl className="mb-4 grid gap-2 text-2">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">
            {t('signalMemoryPatchTarget')}
          </dt>
          <dd className="font-medium text-foreground">
            {patch.title || patch.target_id}
            <span className="ml-2 font-normal text-muted-foreground">
              ({patch.target_id})
            </span>
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">
            {t('signalMemoryPatchBaseSha')}
          </dt>
          <dd className="font-mono text-foreground">{shortSha}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">
            {t('signalMemoryPatchSource')}
          </dt>
          <dd className="text-foreground">{patch.source_app}</dd>
        </div>
      </dl>

      {editing ? (
        <Textarea
          value={draftMarkdown}
          onChange={(e) => setDraftMarkdown(e.target.value)}
          className="mb-3 min-h-[180px] font-mono text-1"
          aria-label={t('signalMemoryPatchEditLabel')}
        />
      ) : (
        <pre className="mb-3 max-h-48 overflow-auto rounded-md border border-border bg-background-2 p-3 text-1 leading-relaxed text-foreground">
          {patch.markdown.slice(0, 4000)}
          {patch.markdown.length > 4000 ? '…' : ''}
        </pre>
      )}

      {actionError ? (
        <Text className="mb-3 block text-2 text-destructive" role="alert">
          {actionError}
        </Text>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            colorVariant="accent"
            disabled={isActing}
            onClick={() => {
              void approve(editing ? draftMarkdown : undefined).catch(
                () => undefined,
              );
            }}
          >
            {t('signalMemoryPatchApprove')}
          </Button>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            disabled={isActing}
            onClick={() => {
              if (!editing) {
                setDraftMarkdown(patch.markdown);
                setEditing(true);
                return;
              }
              void approve(draftMarkdown).catch(() => undefined);
            }}
          >
            {editing
              ? t('signalMemoryPatchApproveEdited')
              : t('signalMemoryPatchEditThenApprove')}
          </Button>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            disabled={isActing}
            onClick={() => {
              void reject().catch(() => undefined);
            }}
          >
            {t('signalMemoryPatchReject')}
          </Button>
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              disabled={isActing}
              onClick={() => setEditing(false)}
            >
              {t('signalMemoryPatchCancelEdit')}
            </Button>
          ) : null}
        </div>
      ) : (
        <Text className="text-2 text-muted-foreground">
          {t('signalMemoryPatchMembersOnly')}
        </Text>
      )}
    </section>
  );
};

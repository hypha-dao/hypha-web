'use client';

import { FC, useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Text } from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@hypha-platform/ui';
import {
  INTELLIGENCE_CORE_TYPES,
  HYPHA_ENERGY_PACK_ID,
  type IntelligenceListItem,
} from '@hypha-platform/core/intelligence';
import { useMatrix, useSpaceBySlug } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import { useSpaceIntelligence } from '../hooks/use-space-intelligence';
import {
  SpaceIntelligenceCard,
  SpaceIntelligenceGraph,
} from './space-intelligence-cards';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import {
  SIGNAL_GRID_CARD_WRAPPER_CLASS,
  SIGNAL_GRID_LAYOUT_CLASS,
} from '../utils/signal-board-layout';

type SpaceIntelligenceSectionProps = {
  spaceSlug: string;
};

type IntelligenceViewMode = 'cards' | 'graph';

export const SpaceIntelligenceSection: FC<SpaceIntelligenceSectionProps> = ({
  spaceSlug,
}) => {
  const t = useTranslations('CoherenceTab');
  const { lang } = useParams<{ lang: Locale; id: string }>();
  const {
    artifacts,
    graph,
    configured,
    isLoading,
    error,
    typeFilter,
    setTypeFilter,
    searchTerm,
    setSearchTerm,
    refresh,
    deleteArtifact,
    linkArtifactRoom,
    enablePack,
    enabledPacks,
  } = useSpaceIntelligence(spaceSlug);
  const { space } = useSpaceBySlug(spaceSlug);
  const { canMutate } = useCanMutateInSpace({
    spaceSlug,
    space,
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const { openThreadChat } = useHumanChatPanel();
  const { isMatrixAvailable, createRoom, joinRoom, loadRoomHistory } =
    useMatrix();

  const [saveError, setSaveError] = useState<string | null>(null);
  const [enablingPack, setEnablingPack] = useState(false);
  const [pendingDelete, setPendingDelete] =
    useState<IntelligenceListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<IntelligenceViewMode>('cards');
  const [commentingId, setCommentingId] = useState<string | null>(null);

  const energyPackEnabled = enabledPacks.includes(HYPHA_ENERGY_PACK_ID);
  const createHref = `/${lang}/dho/${spaceSlug}/memory/new-intelligence`;

  const onConfirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setSaveError(null);
    try {
      await deleteArtifact({
        artifactId: pendingDelete.id,
        expectedSha: pendingDelete.sha,
      });
      setPendingDelete(null);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : t('spaceIntelligenceDeleteFailed'),
      );
    } finally {
      setDeleting(false);
    }
  };

  const onOpenComments = useCallback(
    async (artifact: IntelligenceListItem) => {
      if (commentingId) return;
      setCommentingId(artifact.id);
      setSaveError(null);
      try {
        let roomId = artifact.room_id?.trim() || '';
        if (!roomId) {
          if (!isMatrixAvailable) {
            setSaveError(t('spaceIntelligenceChatUnavailable'));
            return;
          }
          const created = await createRoom(artifact.title, {
            grantCreatorPl100: true,
          });
          const canonicalRoomId = await joinRoom(created.roomId);
          try {
            await loadRoomHistory(canonicalRoomId);
          } catch (historyError) {
            console.warn(
              'Intelligence comment room created but history load failed:',
              historyError,
            );
          }
          await linkArtifactRoom({
            artifactId: artifact.id,
            roomId: canonicalRoomId,
          });
          roomId = canonicalRoomId;
        }
        openThreadChat(roomId, artifact.title, artifact.excerpt ?? null);
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : t('spaceIntelligenceCommentsFailed'),
        );
      } finally {
        setCommentingId(null);
      }
    },
    [
      commentingId,
      createRoom,
      isMatrixAvailable,
      joinRoom,
      linkArtifactRoom,
      loadRoomHistory,
      openThreadChat,
      t,
    ],
  );

  const onEnableEnergyPack = async () => {
    setEnablingPack(true);
    setSaveError(null);
    try {
      await enablePack(HYPHA_ENERGY_PACK_ID);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnablingPack(false);
    }
  };

  return (
    <section
      className="flex w-full flex-col gap-4 py-2"
      aria-label={t('spaceIntelligence')}
    >
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="craft-page-header">
          <h2 className="craft-page-title text-5 font-medium">
            {t('spaceIntelligence')}
            <span className="ml-2 text-3 font-normal text-muted-foreground">
              | {artifacts.length}
            </span>
          </h2>
          <p className="mt-1 text-2 text-muted-foreground">
            {t('spaceIntelligenceSubtitle')}
          </p>
        </div>
        {canMutate ? (
          <div className="flex flex-wrap items-center gap-2">
            {configured && !energyPackEnabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={enablingPack}
                onClick={() => void onEnableEnergyPack()}
              >
                {enablingPack
                  ? t('spaceIntelligenceEnablingPack')
                  : t('spaceIntelligenceEnableEnergyPack')}
              </Button>
            ) : null}
            <Button asChild colorVariant="accent" size="sm">
              <Link href={createHref} className="whitespace-nowrap">
                <PlusIcon />
                {t('spaceIntelligenceNew')}
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger
            className="w-[180px]"
            aria-label={t('spaceIntelligenceFilterType')}
          >
            <SelectValue placeholder={t('spaceIntelligenceFilterType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t('spaceIntelligenceFilterAll')}
            </SelectItem>
            {INTELLIGENCE_CORE_TYPES.map((coreType) => {
              const key = `intelligenceTypes.${coreType}`;
              return (
                <SelectItem key={coreType} value={coreType}>
                  {t.has(key as never) ? t(key as never) : coreType}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('spaceIntelligenceSearch')}
          className="max-w-xs"
        />
        <Tabs
          value={viewMode}
          onValueChange={(value) => setViewMode(value as IntelligenceViewMode)}
          className="ml-auto shrink-0"
        >
          <TabsList
            triggerVariant="switch"
            className="w-fit"
            aria-label={t('spaceIntelligenceViewSwitcher')}
          >
            <TabsTrigger value="cards" variant="switch">
              {t('spaceIntelligenceViewCards')}
            </TabsTrigger>
            <TabsTrigger value="graph" variant="switch">
              {t('spaceIntelligenceViewGraph')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {saveError ? (
        <Text className="text-sm text-destructive">{saveError}</Text>
      ) : null}

      {!configured && !isLoading ? (
        <Text className="text-2 text-muted-foreground">
          {t('spaceIntelligenceNotConfigured')}
        </Text>
      ) : null}

      {error ? (
        <div className="flex flex-col items-start gap-2">
          <Text className="text-muted-foreground">
            {t('spaceIntelligenceError')}
          </Text>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refresh()}
          >
            {t('spaceIntelligenceRetry')}
          </Button>
        </div>
      ) : isLoading ? (
        <Text className="text-muted-foreground">
          {t('spaceIntelligenceLoading')}
        </Text>
      ) : artifacts.length === 0 ? (
        <Text className="text-muted-foreground">
          {t('spaceIntelligenceEmpty')}
        </Text>
      ) : (
        <>
          {viewMode === 'graph' ? (
            <SpaceIntelligenceGraph graph={graph} />
          ) : (
            <div className={SIGNAL_GRID_LAYOUT_CLASS}>
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className={SIGNAL_GRID_CARD_WRAPPER_CLASS}
                >
                  <SpaceIntelligenceCard
                    artifact={artifact}
                    canEdit={canMutate}
                    onDelete={
                      canMutate ? (item) => setPendingDelete(item) : undefined
                    }
                    onOpenComments={onOpenComments}
                    commentsDisabled={
                      commentingId === artifact.id ||
                      (!artifact.room_id?.trim() && !isMatrixAvailable)
                    }
                    commentsTitle={
                      !artifact.room_id?.trim() && !isMatrixAvailable
                        ? t('spaceIntelligenceChatUnavailable')
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('spaceIntelligenceDeleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('spaceIntelligenceDeleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {saveError && pendingDelete ? (
            <p className="text-sm text-error-11">{saveError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('spaceIntelligenceCancelCreate')}
            </AlertDialogCancel>
            <Button
              colorVariant="error"
              disabled={deleting}
              onClick={() => void onConfirmDelete()}
            >
              {deleting
                ? t('spaceIntelligenceDeleting')
                : t('spaceIntelligenceDeleteAction')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

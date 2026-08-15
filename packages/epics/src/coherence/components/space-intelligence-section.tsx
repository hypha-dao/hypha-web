'use client';

import { FC, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Text } from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import {
  INTELLIGENCE_CORE_TYPES,
  HYPHA_ENERGY_PACK_ID,
} from '@hypha-platform/core/intelligence';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import { useSpaceIntelligence } from '../hooks/use-space-intelligence';
import {
  SpaceIntelligenceCard,
  SpaceIntelligenceGraph,
} from './space-intelligence-cards';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import {
  SIGNAL_GRID_CARD_WRAPPER_CLASS,
  SIGNAL_GRID_LAYOUT_CLASS,
} from '../utils/signal-board-layout';

type SpaceIntelligenceSectionProps = {
  spaceSlug: string;
};

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
    enablePack,
    enabledPacks,
  } = useSpaceIntelligence(spaceSlug);
  const { space } = useSpaceBySlug(spaceSlug);
  const { canMutate } = useCanMutateInSpace({
    spaceSlug,
    space,
    spaceId: space?.web3SpaceId ?? undefined,
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [enablingPack, setEnablingPack] = useState(false);

  const energyPackEnabled = enabledPacks.includes(HYPHA_ENERGY_PACK_ID);
  const createHref = `/${lang}/dho/${spaceSlug}/memory/new-intelligence`;

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
          <SpaceIntelligenceGraph graph={graph} />
          <div className={SIGNAL_GRID_LAYOUT_CLASS}>
            {artifacts.map((artifact) => (
              <div key={artifact.id} className={SIGNAL_GRID_CARD_WRAPPER_CLASS}>
                <SpaceIntelligenceCard
                  artifact={artifact}
                  canEdit={canMutate}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

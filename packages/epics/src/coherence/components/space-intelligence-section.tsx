'use client';

import { FC, useState } from 'react';
import { Text } from '@radix-ui/themes';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@hypha-platform/ui';
import {
  INTELLIGENCE_CORE_TYPES,
  HYPHA_ENERGY_PACK_ID,
} from '@hypha-platform/core/intelligence';
import { useTranslations } from 'next-intl';
import { useSpaceIntelligence } from '../hooks/use-space-intelligence';
import {
  SpaceIntelligenceCard,
  SpaceIntelligenceGraph,
} from './space-intelligence-cards';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { useSpaceBySlug } from '@hypha-platform/core/client';

type SpaceIntelligenceSectionProps = {
  spaceSlug: string;
};

function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const SpaceIntelligenceSection: FC<SpaceIntelligenceSectionProps> = ({
  spaceSlug,
}) => {
  const t = useTranslations('CoherenceTab');
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
    createArtifact,
    enablePack,
    enabledPacks,
  } = useSpaceIntelligence(spaceSlug);
  const { space } = useSpaceBySlug(spaceSlug);
  const { canMutate } = useCanMutateInSpace({
    spaceSlug,
    space,
    spaceId: space?.web3SpaceId ?? undefined,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>('assessment');
  const [body, setBody] = useState('');
  const [related, setRelated] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [enablingPack, setEnablingPack] = useState(false);

  const energyPackEnabled = enabledPacks.includes(HYPHA_ENERGY_PACK_ID);

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

  const onCreate = async () => {
    const idBase = slugifyTitle(title);
    if (!idBase) {
      setSaveError(t('spaceIntelligenceCreateTitleRequired'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await createArtifact({
        frontmatter: {
          id: idBase,
          type,
          title: title.trim(),
          space: spaceSlug,
          source_app: 'hypha',
          status: 'current',
          created_at: today,
          updated_at: today,
          tags: [],
          related: related
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          version: 1,
          supersedes: null,
        },
        body,
        source_app: 'hypha',
      });
      setShowCreate(false);
      setTitle('');
      setBody('');
      setRelated('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
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
            <Button
              type="button"
              colorVariant="accent"
              size="sm"
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate
                ? t('spaceIntelligenceCancelCreate')
                : t('spaceIntelligenceNew')}
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
            {INTELLIGENCE_CORE_TYPES.map((coreType) => (
              <SelectItem key={coreType} value={coreType}>
                {coreType}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('spaceIntelligenceSearch')}
          className="max-w-xs"
        />
      </div>

      {showCreate ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="intel-title">
                {t('spaceIntelligenceFieldTitle')}
              </Label>
              <Input
                id="intel-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('spaceIntelligenceFieldType')}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTELLIGENCE_CORE_TYPES.map((coreType) => (
                    <SelectItem key={coreType} value={coreType}>
                      {coreType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intel-related">
              {t('spaceIntelligenceFieldRelated')}
            </Label>
            <Input
              id="intel-related"
              value={related}
              onChange={(e) => setRelated(e.target.value)}
              placeholder="id-one, id-two"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intel-body">
              {t('spaceIntelligenceFieldBody')}
            </Label>
            <Textarea
              id="intel-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
            />
          </div>
          {saveError ? (
            <Text className="text-sm text-destructive">{saveError}</Text>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              colorVariant="accent"
              disabled={saving}
              onClick={() => void onCreate()}
            >
              {saving
                ? t('spaceIntelligenceSaving')
                : t('spaceIntelligencePublish')}
            </Button>
          </div>
        </div>
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
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2 xl:grid-cols-3">
            {artifacts.map((artifact) => (
              <li key={artifact.id}>
                <SpaceIntelligenceCard artifact={artifact} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

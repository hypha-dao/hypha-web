'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import {
  extractLinkedSignalSlug,
  INTELLIGENCE_CORE_TYPES,
} from '@hypha-platform/core/intelligence';
import {
  Button,
  Input,
  Label,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ButtonBack } from '../../common/button-back';
import { ButtonClose } from '../../common/button-close';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import {
  useIntelligenceArtifact,
  useSpaceIntelligence,
} from '../hooks/use-space-intelligence';

export type CreateIntelligenceFormProps = {
  spaceSlug: string;
  successfulUrl: string;
  closeUrl?: string;
  backUrl?: string;
  mode?: 'create' | 'edit';
  artifactId?: string;
};

function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLinkedSignals(value: string): string[] {
  const slugs: string[] = [];
  const seen = new Set<string>();
  for (const item of splitCsv(value)) {
    const slug = extractLinkedSignalSlug(item);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return slugs;
}

export const CreateIntelligenceForm: FC<CreateIntelligenceFormProps> = ({
  spaceSlug,
  successfulUrl,
  closeUrl,
  backUrl,
  mode = 'create',
  artifactId,
}) => {
  const t = useTranslations('CoherenceTab');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const router = useRouter();
  const { space } = useSpaceBySlug(spaceSlug);
  const { canMutate } = useCanMutateInSpace({
    spaceSlug,
    space,
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const { createArtifact } = useSpaceIntelligence(spaceSlug);
  const {
    artifact,
    isLoading: isLoadingArtifact,
    error: loadError,
  } = useIntelligenceArtifact(
    mode === 'edit' ? spaceSlug : undefined,
    mode === 'edit' ? artifactId : undefined,
  );

  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>('insight');
  const [body, setBody] = useState('');
  const [related, setRelated] = useState('');
  const [linkedSignals, setLinkedSignals] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(mode === 'create');

  useEffect(() => {
    if (mode !== 'edit' || !artifact) return;
    setTitle(artifact.frontmatter.title);
    setType(artifact.frontmatter.type);
    setBody(artifact.body);
    setRelated((artifact.frontmatter.related ?? []).join(', '));
    setLinkedSignals((artifact.frontmatter.linked_signals ?? []).join(', '));
    setTags((artifact.frontmatter.tags ?? []).join(', '));
    setHydrated(true);
  }, [artifact, mode]);

  const translateEditor = useCallback(
    (
      key: string,
      defaultValue: string | undefined,
      interpolations?: Record<string, string | number>,
    ) => {
      const translationKey = `createAgreementBaseFields.editor.${key}`;
      if (!tAgreementFlow.has(translationKey)) {
        return defaultValue ?? key;
      }
      return tAgreementFlow(translationKey, interpolations);
    },
    [tAgreementFlow],
  );

  const editable = canMutate && (mode === 'create' || hydrated);
  const headerTitle =
    mode === 'edit'
      ? t('spaceIntelligenceEditTitle')
      : t('spaceIntelligenceCreateTitle');

  const onSubmit = async () => {
    if (!canMutate) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setSaveError(t('spaceIntelligenceCreateTitleRequired'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (mode === 'edit') {
        if (!artifact) {
          throw new Error(t('spaceIntelligenceLoadError'));
        }
        const fm = artifact.frontmatter;
        await createArtifact({
          frontmatter: {
            ...fm,
            title: trimmedTitle,
            type,
            related: splitCsv(related),
            linked_signals: splitLinkedSignals(linkedSignals),
            tags: splitCsv(tags),
            updated_at: today,
          },
          body,
          expectedSha: artifact.sha,
        });
      } else {
        const id = slugifyTitle(trimmedTitle);
        if (!id) {
          setSaveError(t('spaceIntelligenceCreateTitleRequired'));
          setSaving(false);
          return;
        }
        await createArtifact({
          frontmatter: {
            id,
            type,
            title: trimmedTitle,
            space: spaceSlug,
            source_app: 'hypha',
            status: 'current',
            created_at: today,
            updated_at: today,
            tags: splitCsv(tags),
            related: splitCsv(related),
            linked_signals: splitLinkedSignals(linkedSignals),
            version: 1,
            supersedes: null,
          },
          body,
          source_app: 'hypha',
        });
      }
      router.push(successfulUrl);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SpaceLoadingBackdrop
      isLoading={saving}
      message={
        <div>
          {mode === 'edit'
            ? t('spaceIntelligenceSavingUpdate')
            : t('spaceIntelligenceSaving')}
        </div>
      }
    >
      <div className="flex flex-col gap-0">
        <div className="sticky top-0 z-[5] -mx-4 mb-4 border-b border-border/90 bg-background-2 lg:-mx-7">
          <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border/80 px-4 lg:px-7">
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold leading-tight tracking-tight text-foreground">
              {headerTitle}
            </h2>
            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
              {backUrl ? (
                <ButtonBack
                  label={t('spaceIntelligenceCancelCreate')}
                  backUrl={backUrl}
                  className="px-0 align-top md:px-3"
                />
              ) : null}
              <ButtonClose
                closeUrl={closeUrl}
                className="px-0 align-top md:px-3"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 px-4 pb-4 pt-5 lg:px-7">
            <div className="space-y-1.5">
              <Label htmlFor="intel-title">
                {t('spaceIntelligenceFieldTitle')}
              </Label>
              <Input
                id="intel-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!editable}
                placeholder={t('spaceIntelligenceFieldTitle')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('spaceIntelligenceFieldType')}</Label>
              <Select value={type} onValueChange={setType} disabled={!editable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
            </div>
          </div>
        </div>

        {loadError ? (
          <Text className="mb-4 text-sm text-destructive">
            {loadError.message}
          </Text>
        ) : null}
        {mode === 'edit' && isLoadingArtifact ? (
          <Text className="mb-4 text-2 text-muted-foreground">
            {t('spaceIntelligenceLoading')}
          </Text>
        ) : null}

        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <Label htmlFor="intel-related">
              {t('spaceIntelligenceFieldRelated')}
            </Label>
            <Input
              id="intel-related"
              value={related}
              onChange={(event) => setRelated(event.target.value)}
              disabled={!editable}
              placeholder="id-one, id-two"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intel-linked-signals">
              {t('spaceIntelligenceFieldLinkedSignals')}
            </Label>
            <Input
              id="intel-linked-signals"
              value={linkedSignals}
              onChange={(event) => setLinkedSignals(event.target.value)}
              disabled={!editable}
              placeholder={t('spaceIntelligenceFieldLinkedSignalsPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intel-tags">
              {t('spaceIntelligenceFieldTags')}
            </Label>
            <Input
              id="intel-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              disabled={!editable}
              placeholder={t('spaceIntelligenceFieldTagsPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="gap-1 text-foreground">
              {t('spaceIntelligenceFieldBody')}
            </Label>
            <div className="overflow-hidden rounded-lg border border-border/80 bg-background-2 shadow-inner focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background-2">
              {mode === 'edit' && !hydrated ? null : (
                <RichTextEditor
                  editorRef={null}
                  bordered={false}
                  markdown={body}
                  editable={editable}
                  translation={translateEditor}
                  placeholder={t('spaceIntelligenceFieldBodyPlaceholder')}
                  onChange={setBody}
                />
              )}
            </div>
          </div>
          {saveError ? (
            <Text className="text-sm text-destructive">{saveError}</Text>
          ) : null}
          {canMutate ? (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                colorVariant="accent"
                disabled={saving || (mode === 'edit' && !artifact)}
                onClick={() => void onSubmit()}
              >
                {mode === 'edit'
                  ? t('saveChanges')
                  : t('spaceIntelligencePublish')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </SpaceLoadingBackdrop>
  );
};

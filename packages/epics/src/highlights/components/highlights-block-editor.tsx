'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Markdown,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { useImageUpload } from '@hypha-platform/core/client';
import type {
  HighlightsBlock,
  HighlightsBlockType,
  HighlightsProfile,
  HighlightsSupportAction,
} from '@hypha-platform/core/client';
import {
  createDefaultHighlightsBlocks,
  createDefaultSupportActions,
  HIGHLIGHTS_BLOCK_TYPES,
} from '@hypha-platform/core/client';

type HighlightsBlockEditorProps = {
  spaceSlug: string;
  profile: HighlightsProfile | null;
  authToken?: string | null;
  editing: boolean;
  onSaved: () => void;
};

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function HighlightsBlockEditor({
  spaceSlug,
  profile,
  authToken,
  editing,
  onSaved,
}: HighlightsBlockEditorProps) {
  const t = useTranslations('HighlightsTab');
  const [blocks, setBlocks] = useState<HighlightsBlock[]>(
    profile?.blocks?.length
      ? [...profile.blocks].sort((a, b) => a.order - b.order)
      : [],
  );
  const [supportActions, setSupportActions] = useState<
    HighlightsSupportAction[]
  >(profile?.supportActions ?? createDefaultSupportActions());
  const [summary, setSummary] = useState(profile?.summary ?? '');
  const [goalAmount, setGoalAmount] = useState(profile?.goalAmount ?? '');
  const [goalCurrency, setGoalCurrency] = useState(
    profile?.goalCurrency ?? 'EUR',
  );
  const [coverImageUrl, setCoverImageUrl] = useState(
    profile?.coverImageUrl ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addType, setAddType] = useState<HighlightsBlockType>('about');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryBlockIdRef = useRef<string | null>(null);
  const { upload, isUploading } = useImageUpload({
    authorizationToken: authToken ?? undefined,
  });

  useEffect(() => {
    setBlocks(
      profile?.blocks?.length
        ? [...profile.blocks].sort((a, b) => a.order - b.order)
        : [],
    );
    setSupportActions(profile?.supportActions ?? createDefaultSupportActions());
    setSummary(profile?.summary ?? '');
    setGoalAmount(profile?.goalAmount ?? '');
    setGoalCurrency(profile?.goalCurrency ?? 'EUR');
    setCoverImageUrl(profile?.coverImageUrl ?? '');
  }, [profile]);

  const applyTemplate = () => {
    setBlocks(createDefaultHighlightsBlocks());
    setSupportActions(createDefaultSupportActions());
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    setBlocks((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((b) => b.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= sorted.length) return prev;
      const swapped = [...sorted];
      const a = swapped[index]!;
      const b = swapped[next]!;
      swapped[index] = b;
      swapped[next] = a;
      return swapped.map((block, order) => ({ ...block, order }));
    });
  };

  const updateBlock = (id: string, patch: Partial<HighlightsBlock>) => {
    setBlocks((prev) =>
      prev.map((block) => (block.id === id ? { ...block, ...patch } : block)),
    );
  };

  const addBlock = () => {
    setBlocks((prev) => [
      ...prev,
      {
        id: newId(addType),
        type: addType,
        order: prev.length,
        visible: true,
        title: t(`blockTypes.${addType}`),
        body: '',
        items: [],
      },
    ]);
  };

  const uploadGalleryImage = async (blockId: string, file: File) => {
    if (!upload) return;
    const uploaded = await upload([file]);
    const first = uploaded?.[0] as
      | { ufsUrl?: string; url?: string }
      | undefined;
    const url = first?.ufsUrl ?? first?.url;
    if (!url) return;
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        const items = [
          ...(block.items ?? []),
          { id: newId('img'), imageUrl: url, caption: file.name },
        ];
        return { ...block, items };
      }),
    );
  };

  const save = async () => {
    if (!authToken) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/spaces/${spaceSlug}/highlights`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: summary.trim() || null,
          coverImageUrl: coverImageUrl.trim() || null,
          goalAmount: goalAmount.trim() || null,
          goalCurrency: goalCurrency.trim() || null,
          blocks,
          supportActions,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? t('editor.saveFailed'));
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    const visible = [...blocks]
      .filter((b) => b.visible)
      .sort((a, b) => a.order - b.order);
    if (visible.length === 0) {
      return <p className="text-2 text-neutral-11">{t('editor.emptyRead')}</p>;
    }
    return (
      <div className="space-y-6">
        {visible.map((block) => {
          if (block.type === 'stories') return null;
          return (
            <section key={block.id} className="space-y-2">
              <h3 className="text-3 font-medium text-foreground">
                {block.title || t(`blockTypes.${block.type}`)}
              </h3>
              {block.body ? (
                <div className="prose prose-sm max-w-none text-neutral-12">
                  <Markdown>{block.body}</Markdown>
                </div>
              ) : null}
              {block.type === 'gallery' && (block.items?.length ?? 0) > 0 && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {block.items?.map((item) =>
                    item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={item.id}
                        src={item.imageUrl}
                        alt={item.caption ?? ''}
                        className="aspect-square w-full rounded-md object-cover"
                      />
                    ) : null,
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-2 text-neutral-11">{t('editor.emptyEdit')}</p>
          <Button
            className="mt-3"
            colorVariant="accent"
            onClick={applyTemplate}
          >
            {t('editor.startFromTemplate')}
          </Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Input
          placeholder={t('editor.summaryPlaceholder')}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={160}
        />
        <Input
          placeholder={t('editor.coverImagePlaceholder')}
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
        />
        <Input
          placeholder={t('editor.goalAmountPlaceholder')}
          value={goalAmount}
          onChange={(e) => setGoalAmount(e.target.value)}
        />
        <Input
          placeholder={t('editor.goalCurrencyPlaceholder')}
          value={goalCurrency}
          onChange={(e) => setGoalCurrency(e.target.value)}
        />
      </div>

      {[...blocks]
        .sort((a, b) => a.order - b.order)
        .map((block) => (
          <div
            key={block.id}
            className="space-y-2 rounded-lg border border-border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-2 font-medium text-foreground">
                {t(`blockTypes.${block.type}`)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => moveBlock(block.id, -1)}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => moveBlock(block.id, 1)}
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateBlock(block.id, { visible: !block.visible })
                  }
                >
                  {block.visible ? t('editor.hide') : t('editor.show')}
                </Button>
              </div>
            </div>
            <Input
              value={block.title ?? ''}
              onChange={(e) => updateBlock(block.id, { title: e.target.value })}
              placeholder={t('editor.blockTitlePlaceholder')}
            />
            {block.type !== 'gallery' && block.type !== 'stories' && (
              <Textarea
                value={block.body ?? ''}
                onChange={(e) =>
                  updateBlock(block.id, { body: e.target.value })
                }
                rows={5}
                placeholder={t('editor.blockBodyPlaceholder')}
              />
            )}
            {block.type === 'gallery' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {block.items?.map((item) =>
                    item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={item.id}
                        src={item.imageUrl}
                        alt={item.caption ?? ''}
                        className="aspect-square w-full rounded-md object-cover"
                      />
                    ) : null,
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isUploading || !authToken}
                  onClick={() => {
                    galleryBlockIdRef.current = block.id;
                    fileInputRef.current?.click();
                  }}
                >
                  {t('editor.addImage')}
                </Button>
              </div>
            )}
          </div>
        ))}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const blockId = galleryBlockIdRef.current;
          if (file && blockId) {
            void uploadGalleryImage(blockId, file);
          }
          e.target.value = '';
        }}
      />

      <div className="space-y-2 rounded-lg border border-border p-4">
        <h4 className="text-2 font-medium text-foreground">
          {t('support.ctaPrompt')}
        </h4>
        {supportActions.map((action) => (
          <div key={action.id} className="flex items-center gap-2">
            <Checkbox
              id={`cta-${action.id}`}
              checked={action.enabled}
              onCheckedChange={(checked) => {
                setSupportActions((prev) =>
                  prev.map((item) =>
                    item.id === action.id
                      ? { ...item, enabled: checked === true }
                      : item,
                  ),
                );
              }}
            />
            <Label htmlFor={`cta-${action.id}`}>
              {t(`actions.${action.label}`)}
            </Label>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={addType}
          onValueChange={(value) => setAddType(value as HighlightsBlockType)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HIGHLIGHTS_BLOCK_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`blockTypes.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={addBlock}>
          {t('editor.addBlock')}
        </Button>
        <Button
          colorVariant="accent"
          disabled={saving}
          onClick={() => void save()}
        >
          {t('editor.save')}
        </Button>
      </div>
      {error && <p className="text-1 text-destructive">{error}</p>}
    </div>
  );
}

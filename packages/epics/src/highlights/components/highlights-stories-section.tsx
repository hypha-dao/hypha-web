'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import {
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMe,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import type { HighlightsStory } from '@hypha-platform/core/client';

type HighlightsStoriesSectionProps = {
  spaceSlug: string;
  stories: HighlightsStory[];
  canEdit: boolean;
  onCreated: () => void;
};

export function HighlightsStoriesSection({
  spaceSlug,
  stories,
  canEdit,
  onCreated,
}: HighlightsStoriesSectionProps) {
  const t = useTranslations('HighlightsTab');
  const { jwt: authToken } = useJwt();
  const { person } = useMe();
  const { space } = useSpaceBySlug(spaceSlug);
  const { createCoherence, isCreatingCoherence } =
    useCoherenceMutationsWeb2Rsc(authToken);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!title.trim() || !description.trim()) {
      setError(t('stories.required'));
      return;
    }
    if (!person?.id || !space?.id) {
      setError(t('stories.createFailed'));
      return;
    }
    try {
      await createCoherence({
        title: title.trim(),
        description: description.trim(),
        type: 'Story',
        priority: 'medium',
        tags: [] as never[],
        creatorId: person.id,
        spaceId: space.id,
        archived: false,
      });
      setOpen(false);
      setTitle('');
      setDescription('');
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('stories.createFailed'));
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-3 font-medium text-foreground">
          {t('stories.title')}
        </h3>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t('stories.add')}
          </Button>
        )}
      </div>
      {stories.length === 0 ? (
        <p className="text-2 text-neutral-11">{t('stories.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {stories.map((story) => (
            <li
              key={story.id}
              className="rounded-lg border border-border bg-background-2 p-4"
            >
              <div className="text-1 text-neutral-10">
                {new Date(
                  story.eventDate ?? story.createdAt,
                ).toLocaleDateString()}
              </div>
              <h4 className="mt-1 text-2 font-medium text-foreground">
                {story.title}
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-2 text-neutral-11">
                {story.description}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stories.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t('stories.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder={t('stories.bodyPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
            {error && <p className="text-1 text-destructive">{error}</p>}
            <Button
              colorVariant="accent"
              disabled={isCreatingCoherence}
              onClick={() => void submit()}
            >
              {t('stories.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

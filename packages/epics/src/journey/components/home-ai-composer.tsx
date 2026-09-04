'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Textarea } from '@hypha-platform/ui';
import { ArrowUp } from 'lucide-react';
import { useAiPanel } from '../../common/human-chat-panel-context';
import { dispatchAiPromptSeed } from '../../common/ai-prompt-seed';
import type { HomeAttentionItem } from '../home-activity';

type Chip = { id: string; label: string; prompt: string };

export function HomeAiComposer({
  featured,
  onCapture,
}: {
  featured: HomeAttentionItem | null;
  onCapture?: () => void;
}) {
  const t = useTranslations('Journey');
  const { openAiPanel } = useAiPanel();
  const [draft, setDraft] = useState('');

  const chips = useMemo(() => {
    const items: Chip[] = [];
    if (featured?.kind === 'vote') {
      items.push({
        id: 'vote',
        label: t('aiSuggestionVoteTag'),
        prompt: t('aiSuggestionVote', { title: featured.title }),
      });
      items.push({
        id: 'voteExplain',
        label: t('aiSuggestionVoteExplainTag'),
        prompt: t('aiSuggestionVoteExplain', { title: featured.title }),
      });
    } else if (featured?.kind === 'signal') {
      items.push({
        id: 'signal',
        label: t('aiSuggestionSignalTag'),
        prompt: t('aiSuggestionSignal', { title: featured.title }),
      });
      items.push({
        id: 'signalDraft',
        label: t('aiSuggestionSignalDraftTag'),
        prompt: t('aiSuggestionSignalDraft'),
      });
    } else if (featured?.kind === 'task') {
      items.push({
        id: 'task',
        label: t('aiSuggestionTaskTag'),
        prompt: t('aiSuggestionTask', { title: featured.title }),
      });
      items.push({
        id: 'taskTake',
        label: t('aiSuggestionTaskTakeTag'),
        prompt: t('aiSuggestionTaskTake', { title: featured.title }),
      });
    } else {
      items.push({
        id: 'useful',
        label: t('aiSuggestionUsefulTag'),
        prompt: t('aiSuggestionUseful'),
      });
    }
    items.push({
      id: 'space',
      label: t('aiSuggestionSpaceTag'),
      prompt: t('aiSuggestionSpace'),
    });
    if (!featured) {
      items.push({
        id: 'people',
        label: t('aiSuggestionPeopleTag'),
        prompt: t('aiSuggestionPeople'),
      });
    }
    return items.slice(0, 4);
  }, [featured, t]);

  const send = (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;
    dispatchAiPromptSeed(text);
    openAiPanel();
    setDraft('');
  };

  return (
    <div className="mt-auto flex flex-col gap-3 border-t border-border/70 pt-4">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => send(chip.prompt)}
            className="rounded-xl border border-border/70 bg-background-2 px-2.5 py-1 text-1 text-foreground transition-colors hover:border-accent-7 hover:bg-accent-2"
          >
            {chip.label}
          </button>
        ))}
        {onCapture ? (
          <button
            type="button"
            onClick={onCapture}
            className="rounded-xl border border-border/70 bg-background-2 px-2.5 py-1 text-1 text-foreground transition-colors hover:border-accent-7 hover:bg-accent-2"
          >
            {t('aiSuggestionCaptureTag')}
          </button>
        ) : null}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send(draft);
            }
          }}
          placeholder={t('aiComposerPlaceholder')}
          rows={1}
          className="min-h-[44px] max-h-28 resize-none rounded-xl"
        />
        <Button
          type="submit"
          size="sm"
          className="size-11 shrink-0 rounded-xl p-0"
          disabled={!draft.trim()}
          aria-label={t('aiComposerSend')}
        >
          <ArrowUp className="size-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}

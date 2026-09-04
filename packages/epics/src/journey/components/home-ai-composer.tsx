'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Textarea } from '@hypha-platform/ui';
import { ArrowUp } from 'lucide-react';
import { useAiPanel } from '../../common/human-chat-panel-context';
import { LiveVoiceMicIcon } from '../../common/ai-panel/live-voice-mic-icon';
import {
  dispatchAiPromptSeed,
  dispatchAiVoiceStart,
} from '../../common/ai-prompt-seed';
import type { HomeAttentionItem } from '../home-activity';

type Chip = {
  id: string;
  label: string;
  prompt?: string;
  action?: 'capture' | 'pay' | 'call';
};

export function HomeAiComposer({
  featured,
  onCapture,
  onPay,
  onCall,
  onSend,
}: {
  featured: HomeAttentionItem | null;
  onCapture?: () => void;
  onPay?: () => void;
  onCall?: () => void;
  onSend?: (prompt: string) => void;
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
    if (onCall) {
      items.push({
        id: 'call',
        label: t('aiSuggestionCallTag'),
        action: 'call',
      });
    }
    if (onPay) {
      items.push({ id: 'pay', label: t('aiSuggestionPayTag'), action: 'pay' });
    }
    if (onCapture) {
      items.push({
        id: 'capture',
        label: t('aiSuggestionCaptureTag'),
        action: 'capture',
      });
    }
    return items.slice(0, 6);
  }, [featured, onCall, onCapture, onPay, t]);

  const send = (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;
    onSend?.(text);
    dispatchAiPromptSeed(text);
    openAiPanel();
    setDraft('');
  };

  const talk = () => {
    dispatchAiVoiceStart();
    openAiPanel();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => {
              if (chip.action === 'capture') {
                onCapture?.();
                return;
              }
              if (chip.action === 'pay') {
                onPay?.();
                return;
              }
              if (chip.action === 'call') {
                onCall?.();
                return;
              }
              if (chip.prompt) send(chip.prompt);
            }}
            className="rounded-xl border border-border/70 bg-background-2 px-2.5 py-1 text-1 text-foreground transition-colors hover:border-accent-7 hover:bg-accent-2"
          >
            {chip.label}
          </button>
        ))}
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
          type="button"
          size="sm"
          variant="outline"
          colorVariant="neutral"
          className="size-11 shrink-0 rounded-xl p-0"
          onClick={talk}
          aria-label={t('usefulTalk')}
          title={t('usefulTalkHint')}
        >
          <LiveVoiceMicIcon size="md" />
        </Button>
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

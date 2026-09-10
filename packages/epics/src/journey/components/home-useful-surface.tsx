'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useJwt, usePatchCoherenceTask } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button, Card, CardContent } from '@hypha-platform/ui';
import { Compass, Sparkles } from 'lucide-react';
import { getOnboardingPath } from '../../common/get-path-function';
import {
  AI_CHAT_MIRROR_EVENT,
  dispatchAiPromptSeed,
  type AiChatMirrorDetail,
} from '../../common/ai-prompt-seed';
import {
  useAiPanel,
  useHumanChatPanel,
} from '../../common/human-chat-panel-context';
import { speakOnboardingText } from '../../common/onboarding-voice-speech';
import { cn } from '@hypha-platform/ui-utils';
import { attentionSeeAllHref, type HomeAttentionItem } from '../home-activity';
import {
  agendaKeysInThread,
  appendAgendaBlock,
  appendLocalAiBlock,
  appendUserBlock,
  attentionItemKey,
  nextUnseenAttentionItem,
  remainingAfterSeen,
  upsertChatAiBlock,
  type UsefulThreadBlock,
} from '../home-useful-thread';
import { UsefulHarvestArt } from './journey-mark';
import { HomeVotePanel } from './home-vote-panel';
import { HomeAiComposer } from './home-ai-composer';
import { HomePayOverlay } from './home-pay-overlay';

function openClosesAt(item: HomeAttentionItem, nowMs: number): number | null {
  if (item.kind === 'signal') return null;
  const closesAt = item.closesAt;
  if (closesAt == null) return null;
  return closesAt > nowMs ? closesAt : null;
}

function kindLabel(
  item: HomeAttentionItem,
  t: (key: 'usefulKindVote' | 'usefulKindTask' | 'usefulKindSignal') => string,
) {
  if (item.kind === 'vote') return t('usefulKindVote');
  if (item.kind === 'task') return t('usefulKindTask');
  return t('usefulKindSignal');
}

function newBlockId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function HomeUsefulSurface({
  lang,
  items,
  isLoading,
  fallbackSpaces,
  firstName,
  personId,
  onCapture,
  className,
}: {
  lang: Locale;
  items: HomeAttentionItem[];
  isLoading?: boolean;
  fallbackSpaces: Array<{ slug?: string | null }>;
  firstName?: string;
  personId?: number | null;
  onCapture?: () => void;
  className?: string;
}) {
  const t = useTranslations('Journey');
  const locale = useLocale();
  const format = useFormatter();
  const { openAiPanel } = useAiPanel();
  const { openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const { jwt } = useJwt();
  const threadRef = useRef<HTMLDivElement>(null);
  const knownChatIds = useRef(new Set<string>());
  const mirrorReady = useRef(false);
  const spokenAiIds = useRef(new Set<string>());
  const seededItemKeys = useRef(new Set<string>());

  const [blocks, setBlocks] = useState<UsefulThreadBlock[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [weighing, setWeighing] = useState<string[]>([]);
  const [claimState, setClaimState] = useState<
    Record<string, 'idle' | 'claiming' | 'claimed' | 'error'>
  >({});
  const [payOpen, setPayOpen] = useState(false);
  const [sensing, setSensing] = useState(false);

  const itemsByKey = useMemo(() => {
    const map = new Map<string, HomeAttentionItem>();
    for (const item of items) map.set(attentionItemKey(item), item);
    return map;
  }, [items]);

  const current = useMemo(() => {
    const keys = agendaKeysInThread(blocks);
    for (let i = keys.length - 1; i >= 0; i -= 1) {
      const key = keys[i];
      if (!key || seen.includes(key)) continue;
      const item = itemsByKey.get(key);
      if (item) return item;
    }
    return nextUnseenAttentionItem(items, seen);
  }, [blocks, items, itemsByKey, seen]);

  const { patchTask, isPatching } = usePatchCoherenceTask(
    current?.kind === 'task' ? current.spaceSlug : undefined,
  );

  const now = new Date();
  const nowMs = now.getTime();
  const currentClosesAt = current ? openClosesAt(current, nowMs) : null;
  const currentRelative = currentClosesAt
    ? format.relativeTime(new Date(currentClosesAt), now)
    : null;
  const remaining = remainingAfterSeen(
    items.length,
    Math.max(seen.length, agendaKeysInThread(blocks).length),
  );
  const seeAllHref = attentionSeeAllHref(lang, items, fallbackSpaces);

  const urgency = (() => {
    if (!current && items.length === 0) return null;
    if (currentRelative) {
      return remaining > 0
        ? t('usefulUrgencyClosing', {
            time: currentRelative,
            count: remaining,
          })
        : t('usefulUrgencyClosingLast', { time: currentRelative });
    }
    if (!current) return null;
    return remaining > 0
      ? t('usefulUrgencyOpen', { count: remaining })
      : t('usefulUrgencyOpenLast');
  })();

  const bodyFor = (item: HomeAttentionItem) => {
    const name = firstName?.trim();
    const title = item.title;
    const space = item.spaceTitle;
    if (item.kind === 'vote') {
      const closesAt = openClosesAt(item, nowMs);
      const relative = closesAt
        ? format.relativeTime(new Date(closesAt), now)
        : null;
      if (relative) {
        const closes = t('usefulCloses', { time: relative });
        return name
          ? t('usefulBodyVoteClosingNamed', { name, title, space, closes })
          : t('usefulBodyVoteClosing', { title, space, closes });
      }
      return name
        ? t('usefulBodyVoteNamed', { name, title, space })
        : t('usefulBodyVote', { title, space });
    }
    if (item.kind === 'task') {
      return name
        ? t('usefulBodyTaskNamed', { name, title, space })
        : t('usefulBodyTask', { title, space });
    }
    return name
      ? t('usefulBodySignalNamed', { name, title, space })
      : t('usefulBodySignal', { title, space });
  };

  const scrollToEnd = () => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  };

  const speak = (id: string, text: string) => {
    if (!text.trim() || spokenAiIds.current.has(id)) return;
    spokenAiIds.current.add(id);
    speakOnboardingText(text, { lang: locale });
  };

  const revealItem = (item: HomeAttentionItem) => {
    const key = attentionItemKey(item);
    setBlocks((currentBlocks) => {
      let next = appendAgendaBlock(currentBlocks, key, newBlockId('agenda'));
      if (!seededItemKeys.current.has(key)) {
        seededItemKeys.current.add(key);
        next = appendLocalAiBlock(next, bodyFor(item), newBlockId('ai-local'));
      }
      return next;
    });
  };

  useEffect(() => {
    if (isLoading) return;
    const next = nextUnseenAttentionItem(items, [
      ...seen,
      ...agendaKeysInThread(blocks),
    ]);
    if (next) revealItem(next);
    // First paint only needs the latest unseen item; later actions append explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed from live attention, not every block change
  }, [isLoading, items]);

  useEffect(() => {
    const lastAi = [...blocks].reverse().find((block) => block.type === 'ai');
    if (lastAi?.type === 'ai' && lastAi.text && !lastAi.streaming) {
      speak(lastAi.id, lastAi.text);
    }
    scrollToEnd();
  }, [blocks]);

  useEffect(() => {
    const onMirror = (event: Event) => {
      const detail = (event as CustomEvent<AiChatMirrorDetail>).detail;
      if (!detail) return;
      const streaming =
        detail.status === 'streaming' || detail.status === 'submitted';
      setSensing(streaming);
      if (!mirrorReady.current) {
        for (const message of detail.messages) {
          if (message.role === 'assistant') {
            knownChatIds.current.add(message.id);
          }
        }
        mirrorReady.current = true;
        return;
      }
      for (const message of detail.messages) {
        if (message.role !== 'assistant' || !message.text.trim()) continue;
        if (
          knownChatIds.current.has(message.id) &&
          !streaming &&
          message.id !== detail.messages.at(-1)?.id
        ) {
          continue;
        }
        knownChatIds.current.add(message.id);
        setBlocks((currentBlocks) =>
          upsertChatAiBlock(
            currentBlocks,
            message.id,
            message.text,
            streaming && message.id === detail.messages.at(-1)?.id,
          ),
        );
      }
    };
    window.addEventListener(AI_CHAT_MIRROR_EVENT, onMirror);
    return () => {
      window.removeEventListener(AI_CHAT_MIRROR_EVENT, onMirror);
    };
  }, []);

  const talkToAi = (prompt: string) => {
    dispatchAiPromptSeed(prompt);
    openAiPanel();
  };

  const appendUserAndAdvance = (
    text: string,
    item: HomeAttentionItem,
    tellAi: string | null,
  ) => {
    const key = attentionItemKey(item);
    setSeen((currentSeen) =>
      currentSeen.includes(key) ? currentSeen : [...currentSeen, key],
    );
    setWeighing((currentWeighing) =>
      currentWeighing.filter((value) => value !== key),
    );
    setBlocks((currentBlocks) =>
      appendUserBlock(currentBlocks, text, newBlockId('user')),
    );
    if (tellAi) talkToAi(tellAi);
    const next = nextUnseenAttentionItem(items, [...seen, key]);
    if (next) {
      window.setTimeout(() => revealItem(next), 80);
    }
  };

  const skipItem = (item: HomeAttentionItem) => {
    appendUserAndAdvance(t('usefulNotNow'), item, t('aiSuggestionSkipped'));
  };

  const respondToSignal = (
    item: Extract<HomeAttentionItem, { kind: 'signal' | 'task' }>,
    help = false,
  ) => {
    if (item.signalSlug) {
      openCoherenceChat(
        item.roomId ?? null,
        item.title,
        item.signalSlug,
        item.description,
      );
    }
    appendUserAndAdvance(
      help ? t('usefulHelp') : t('usefulRespond'),
      item,
      t('aiSuggestionSignal', { title: item.title }),
    );
  };

  const takeTask = async (
    item: Extract<HomeAttentionItem, { kind: 'task' }>,
  ) => {
    const key = attentionItemKey(item);
    if (!item.signalSlug) return;
    if (!personId || !jwt) {
      setClaimState((currentState) => ({ ...currentState, [key]: 'error' }));
      return;
    }
    if (item.assigneeIds.includes(personId)) {
      setClaimState((currentState) => ({ ...currentState, [key]: 'claimed' }));
      respondToSignal(item);
      return;
    }
    setClaimState((currentState) => ({ ...currentState, [key]: 'claiming' }));
    try {
      await patchTask({
        slug: item.signalSlug,
        assigneeIds: [...item.assigneeIds, personId],
      });
      setClaimState((currentState) => ({ ...currentState, [key]: 'claimed' }));
      appendUserAndAdvance(
        t('usefulTakeIt'),
        item,
        t('aiSuggestionTaskTake', { title: item.title }),
      );
    } catch {
      setClaimState((currentState) => ({ ...currentState, [key]: 'error' }));
    }
  };

  const empty = !isLoading && items.length === 0 && blocks.length === 0;

  return (
    <Card className={cn('craft-card flex min-h-0 flex-1 flex-col', className)}>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <UsefulHarvestArt className="mb-3 h-14 w-[8.5rem]" />
            <h2 className="[font-family:var(--font-family-heading)] text-5 font-semibold tracking-[-0.015em]">
              {t('usefulTitle')}
            </h2>
          </div>
          {urgency ? (
            <p className="max-w-[22ch] text-right text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {urgency}
            </p>
          ) : null}
        </header>

        <div
          ref={threadRef}
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5"
        >
          {isLoading && blocks.length === 0 ? (
            <p className="text-2 text-muted-foreground">{t('usefulLoading')}</p>
          ) : null}

          {empty ? (
            <div className="flex flex-col gap-4">
              <p className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
                {t('usefulEmptyTitle')}
              </p>
              <p className="max-w-[46ch] text-2 leading-relaxed text-muted-foreground">
                {t('usefulEmptyLead')}
              </p>
              <div className="flex flex-wrap gap-2">
                {onCapture ? (
                  <Button
                    type="button"
                    className="rounded-xl"
                    onClick={onCapture}
                  >
                    <Sparkles className="size-4" aria-hidden />
                    {t('usefulEmptyCapture')}
                  </Button>
                ) : null}
                <Button asChild variant="outline" colorVariant="neutral">
                  <Link href={getOnboardingPath(lang)}>
                    {t('usefulEmptyCreate')}
                  </Link>
                </Button>
                <Button asChild variant="outline" colorVariant="neutral">
                  <Link href={`/${lang}/network`}>
                    <Compass className="size-4" aria-hidden />
                    {t('usefulEmptyExplore')}
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          {blocks.map((block) => {
            if (block.type === 'user') {
              return (
                <div key={block.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-xl bg-accent-9 px-4 py-2.5 text-2 font-medium text-accent-contrast">
                    {block.text}
                  </p>
                </div>
              );
            }
            if (block.type === 'ai') {
              return (
                <div key={block.id} className="flex flex-col gap-1">
                  <p className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
                    {t('usefulAiName')}
                  </p>
                  <p className="max-w-[46ch] text-3 leading-snug">
                    {block.text || (block.streaming ? t('usefulSensing') : '')}
                  </p>
                </div>
              );
            }
            const item = itemsByKey.get(block.itemKey);
            if (!item) return null;
            const acted = seen.includes(block.itemKey);
            const closesAt = openClosesAt(item, nowMs);
            const relative = closesAt
              ? format.relativeTime(new Date(closesAt), now)
              : null;
            const itemClaim = claimState[block.itemKey] ?? 'idle';
            const holdingTask =
              item.kind === 'task' &&
              personId != null &&
              item.assigneeIds.includes(personId);
            const showVote =
              item.kind === 'vote' && weighing.includes(block.itemKey);

            return (
              <article key={block.id} className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-2 size-2.5 shrink-0 rounded-full bg-success-9"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-3 font-medium leading-snug">
                      {item.title}
                    </p>
                    <p className="mt-1 text-1 text-muted-foreground">
                      <span>{item.spaceTitle}</span>
                      <span aria-hidden> · </span>
                      <span>{kindLabel(item, (key) => t(key))}</span>
                      {relative ? (
                        <>
                          <span aria-hidden> · </span>
                          <span className="text-warning-11">
                            {t('usefulCloses', { time: relative })}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>

                {acted && !(item.kind === 'vote' && showVote) ? (
                  <p className="text-2 text-muted-foreground">
                    {itemClaim === 'claimed' || holdingTask
                      ? t('usefulClaimed')
                      : t('usefulPassed')}
                  </p>
                ) : null}

                {item.kind === 'vote' && showVote ? (
                  <HomeVotePanel
                    item={item}
                    onVoted={(vote) => {
                      const key = attentionItemKey(item);
                      setSeen((currentSeen) =>
                        currentSeen.includes(key)
                          ? currentSeen
                          : [...currentSeen, key],
                      );
                      setBlocks((currentBlocks) =>
                        appendUserBlock(
                          currentBlocks,
                          vote === 'yes'
                            ? t('usefulVotedYes')
                            : t('usefulVotedNo'),
                          newBlockId('user'),
                        ),
                      );
                      const next = nextUnseenAttentionItem(items, [
                        ...seen,
                        key,
                      ]);
                      if (next) {
                        window.setTimeout(() => revealItem(next), 80);
                      }
                    }}
                  />
                ) : item.kind === 'vote' && !acted ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      className="rounded-xl"
                      onClick={() => {
                        setWeighing((currentWeighing) =>
                          currentWeighing.includes(block.itemKey)
                            ? currentWeighing
                            : [...currentWeighing, block.itemKey],
                        );
                        setBlocks((currentBlocks) =>
                          appendUserBlock(
                            currentBlocks,
                            t('usefulWeighIn'),
                            newBlockId('user'),
                          ),
                        );
                        talkToAi(t('aiSuggestionVote', { title: item.title }));
                      }}
                    >
                      {t('usefulWeighIn')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      colorVariant="neutral"
                      className="rounded-xl"
                      onClick={() => skipItem(item)}
                    >
                      {t('usefulNotNow')}
                    </Button>
                  </div>
                ) : item.kind === 'task' && !acted ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        className="rounded-xl"
                        disabled={isPatching || itemClaim === 'claiming'}
                        onClick={() => void takeTask(item)}
                      >
                        {holdingTask || itemClaim === 'claimed'
                          ? t('usefulClaimed')
                          : t('usefulTakeIt')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        colorVariant="neutral"
                        className="rounded-xl"
                        onClick={() => respondToSignal(item)}
                      >
                        {t('usefulRespond')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        colorVariant="neutral"
                        className="rounded-xl"
                        onClick={() => skipItem(item)}
                      >
                        {t('usefulNotNow')}
                      </Button>
                    </div>
                    {itemClaim === 'claiming' ? (
                      <p className="text-1 text-muted-foreground">
                        {t('usefulClaiming')}
                      </p>
                    ) : null}
                    {itemClaim === 'error' ? (
                      <p className="text-2 text-error-11">
                        {t('usefulClaimError')}
                      </p>
                    ) : null}
                  </div>
                ) : item.kind === 'signal' && !acted ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      className="rounded-xl"
                      onClick={() => respondToSignal(item, true)}
                    >
                      {t('usefulHelp')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      colorVariant="neutral"
                      className="rounded-xl"
                      onClick={() => {
                        openHumanChatPanel();
                      }}
                    >
                      {t('usefulCall')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      colorVariant="neutral"
                      className="rounded-xl"
                      onClick={() => setPayOpen(true)}
                    >
                      {t('usefulSendTokens')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      colorVariant="neutral"
                      className="rounded-xl"
                      onClick={() => skipItem(item)}
                    >
                      {t('usefulNotNow')}
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}

          {sensing ? (
            <p className="text-2 text-muted-foreground">{t('usefulSensing')}</p>
          ) : null}

          {!isLoading && items.length > 0 && !current && remaining === 0 ? (
            <p className="max-w-[46ch] text-2 leading-relaxed text-muted-foreground">
              {t('usefulEmptyLead')}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border/70 px-5 py-4">
          <HomeAiComposer
            featured={current}
            onCapture={onCapture}
            onPay={() => setPayOpen(true)}
            onCall={() => openHumanChatPanel()}
            onSend={(prompt) => {
              setBlocks((currentBlocks) =>
                appendUserBlock(currentBlocks, prompt, newBlockId('user')),
              );
            }}
          />
          <div className="mt-3 flex justify-end">
            <Button asChild variant="ghost" colorVariant="neutral">
              <Link href={seeAllHref}>{t('attentionSeeAll')}</Link>
            </Button>
          </div>
        </div>
      </CardContent>
      <HomePayOverlay lang={lang} open={payOpen} onOpenChange={setPayOpen} />
    </Card>
  );
}

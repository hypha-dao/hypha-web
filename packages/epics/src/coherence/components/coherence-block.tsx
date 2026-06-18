'use client';

import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import {
  Coherence,
  useFindCoherences,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { CoherenceOrder } from '../types';
import { SignalSection } from './signal-section';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';

type CoherenceBlockProps = {
  lang: Locale;
  spaceSlug: string;
  order?: CoherenceOrder;
  priorityFilter?: 'all' | 'critical' | 'high' | 'medium' | 'low';
  humanChatEnabled?: boolean;
};

type PriorityFilterTabItem = {
  value: string;
  label: string;
  count?: number | null;
};

function PriorityFilterTabs({
  items,
  defaultValue,
  queryKey,
}: {
  items: PriorityFilterTabItem[];
  defaultValue: string;
  queryKey: string;
}) {
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentValue = React.useMemo(() => {
    const raw = searchParams.get(queryKey);
    if (!raw) return defaultValue;
    return items.some((item) => item.value === raw) ? raw : defaultValue;
  }, [defaultValue, items, queryKey, searchParams]);

  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (nextValue === defaultValue) {
        nextParams.delete(queryKey);
      } else {
        nextParams.set(queryKey, nextValue);
      }
      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [defaultValue, pathname, queryKey, router, searchParams],
  );

  return (
    <Tabs value={currentValue} onValueChange={handleValueChange}>
      <TabsList triggerVariant="switch" className="w-fit">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} variant="switch">
            <span className="inline-flex items-center gap-1">
              <span>{item.label}</span>
              {typeof item.count === 'number' && Number.isFinite(item.count) ? (
                <span className="text-xs text-muted-foreground">
                  ({format.number(item.count)})
                </span>
              ) : null}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function CoherenceBlock({
  lang,
  spaceSlug,
  order,
  priorityFilter = 'all',
  humanChatEnabled = false,
}: CoherenceBlockProps) {
  const t = useTranslations('CoherenceTab');
  const format = useFormatter();
  const [hideArchived, setHideArchived] = React.useState(true);
  const { space, isLoading: isSpaceLoading } = useSpaceBySlug(spaceSlug);
  const {
    coherences: signals,
    isLoading: isSignalsLoading,
    refresh: refreshSignals,
  } = useFindCoherences({
    spaceSlug,
    includeArchived: !hideArchived,
    orderBy: order,
  });
  const filteredSignals = React.useMemo(
    () =>
      (signals ?? []).filter((signal) =>
        priorityFilter === 'all' ? true : signal.priority === priorityFilter,
      ),
    [priorityFilter, signals],
  );
  const priorityCounts = React.useMemo(() => {
    const items = signals ?? [];
    return {
      all: items.length,
      critical: items.filter((signal) => signal.priority === 'critical').length,
      high: items.filter((signal) => signal.priority === 'high').length,
      medium: items.filter((signal) => signal.priority === 'medium').length,
      low: items.filter((signal) => signal.priority === 'low').length,
    };
  }, [signals]);

  const refresh = React.useCallback(async () => {
    await refreshSignals();
  }, [refreshSignals]);

  const chatBasePath = React.useMemo(
    () => `/${lang}/dho/${spaceSlug}/coherence/chat`,
    [lang, spaceSlug],
  );

  const { openCoherenceChat } = useHumanChatPanel();

  const handleSignalClick = React.useCallback(
    (signal: Coherence) => {
      openCoherenceChat(
        signal.roomId ?? null,
        signal.title ?? '',
        signal.slug ?? '',
        signal.description ?? null,
      );
    },
    [openCoherenceChat],
  );

  const onSignalClick = humanChatEnabled ? handleSignalClick : undefined;

  const priorityTabs = (
    <PriorityFilterTabs
      queryKey="priority"
      defaultValue="all"
      items={[
        { value: 'all', label: t('all'), count: priorityCounts.all },
        {
          value: 'critical',
          label: t('priorities.critical'),
          count: priorityCounts.critical,
        },
        {
          value: 'high',
          label: t('priorities.high'),
          count: priorityCounts.high,
        },
        {
          value: 'medium',
          label: t('priorities.medium'),
          count: priorityCounts.medium,
        },
        {
          value: 'low',
          label: t('priorities.low'),
          count: priorityCounts.low,
        },
      ]}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h1 className="text-7 font-semibold tracking-tight text-foreground">
          {t('signals')}
          {typeof signals?.length === 'number' ? (
            <span className="ml-2 text-5 font-medium text-muted-foreground">
              | {format.number(signals.length)}
            </span>
          ) : null}
        </h1>
      </div>
      <div className="flex flex-col gap-4">
        <SignalSection
          toolbarLeft={priorityTabs}
          basePath={chatBasePath}
          web3SpaceId={space?.web3SpaceId ?? 0}
          signals={filteredSignals}
          leadImage={space?.leadImage ?? undefined}
          isLoading={isSpaceLoading || isSignalsLoading}
          hideArchived={hideArchived}
          setHideArchived={setHideArchived}
          refresh={refresh}
          onSignalClick={onSignalClick}
        />
      </div>
    </div>
  );
}

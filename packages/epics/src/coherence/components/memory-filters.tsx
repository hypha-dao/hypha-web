'use client';

import Link from 'next/link';
import { SearchIcon } from 'lucide-react';
import { Button, Input, Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export type MemoryFilterValue =
  | 'general'
  | 'proposals'
  | 'conversations'
  | 'ai-chat';

type MemoryFiltersProps = {
  totalCount: number;
  activeFilter: MemoryFilterValue;
  onFilterChange: (value: MemoryFilterValue) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  newMemoryHref: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  counts: Record<MemoryFilterValue, number>;
};

export function MemoryFilters({
  totalCount,
  activeFilter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  newMemoryHref,
  onRefresh,
  isRefreshing,
  counts,
}: MemoryFiltersProps) {
  const t = useTranslations('CoherenceTab');

  const tabItems: Array<{ value: MemoryFilterValue; label: string }> = [
    { value: 'general', label: t('spaceMemoryGeneral') },
    { value: 'proposals', label: t('spaceMemoryProposals') },
    { value: 'conversations', label: t('spaceMemoryConversations') },
    { value: 'ai-chat', label: t('spaceMemoryAiChat') },
  ];

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-4 font-semibold tracking-tight text-foreground">
            {t('spaceMemory')} <span className="text-muted-foreground">|</span>{' '}
            <span className="text-muted-foreground">{totalCount}</span>
          </h2>
        </div>

        <Button asChild variant="default" colorVariant="accent">
          <Link href={newMemoryHref} scroll={false}>
            {t('newMemory')}
          </Link>
        </Button>
      </div>

      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={activeFilter}
          onValueChange={(value) => onFilterChange(value as MemoryFilterValue)}
          className="w-full lg:w-auto"
        >
          <TabsList triggerVariant="switch" className="w-fit">
            {tabItems.map((item) => (
              <TabsTrigger key={item.value} variant="switch" value={item.value}>
                <span className="inline-flex items-center gap-1">
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    ({counts[item.value] ?? 0})
                  </span>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <Input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('searchSpaceMemory')}
            leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
            className="w-full lg:w-[22rem]"
          />

          <Button
            type="button"
            variant="ghost"
            colorVariant="accent"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto"
          >
            {t('spaceMemoryRefresh')}
          </Button>
        </div>
      </div>
    </div>
  );
}

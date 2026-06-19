'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { SearchIcon } from 'lucide-react';
import {
  Button,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  useIsMobile,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export type MemoryFilterValue =
  | 'general'
  | 'proposals'
  | 'conversations'
  | 'calls'
  | 'ai-chat';

type MemoryFiltersProps = {
  activeFilter: MemoryFilterValue;
  onFilterChange: (value: MemoryFilterValue) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  newMemoryHref: string;
  canCreateMemory?: boolean;
  isCreateMemoryLoading?: boolean;
  counts: Record<MemoryFilterValue, number>;
};

export function MemoryFilters({
  activeFilter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  newMemoryHref,
  canCreateMemory = false,
  isCreateMemoryLoading = false,
  counts,
}: MemoryFiltersProps) {
  const t = useTranslations('CoherenceTab');
  const isMobile = useIsMobile() ?? false;
  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;

  const tabItems: Array<{ value: MemoryFilterValue; label: string }> = [
    { value: 'general', label: t('spaceMemoryGeneral') },
    { value: 'proposals', label: t('spaceMemoryProposals') },
    { value: 'conversations', label: t('spaceMemoryConversations') },
    { value: 'calls', label: t('spaceMemoryCalls') },
    { value: 'ai-chat', label: t('spaceMemoryAiChat') },
  ];

  const visibleTabItems = isMobile
    ? tabItems.filter((item) => item.value !== 'general')
    : tabItems;

  useEffect(() => {
    if (isMobile && activeFilter === 'general') {
      onFilterChangeRef.current('proposals');
    }
  }, [activeFilter, isMobile]);

  return (
    <div className="flex w-full flex-col gap-4">
      <Tabs
        value={activeFilter}
        onValueChange={(value) => onFilterChange(value as MemoryFilterValue)}
        className="w-full"
      >
        <TabsList triggerVariant="switch" className="w-fit max-w-full">
          {visibleTabItems.map((item) => (
            <TabsTrigger
              key={item.value}
              variant="switch"
              value={item.value}
              className="justify-center"
            >
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

      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('searchSpaceMemory')}
          aria-label={t('searchSpaceMemory')}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          className="w-full"
        />
        <div className="flex w-full items-center justify-end gap-2 lg:w-auto">
          {canCreateMemory ? (
            <Button asChild variant="default" colorVariant="accent">
              <Link href={newMemoryHref} scroll={false}>
                {t('newMemory')}
              </Link>
            </Button>
          ) : (
            <Button
              variant="default"
              colorVariant="accent"
              disabled={isCreateMemoryLoading || !canCreateMemory}
            >
              {t('newMemory')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

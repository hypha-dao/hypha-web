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
  activeFilter: MemoryFilterValue;
  onFilterChange: (value: MemoryFilterValue) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  newMemoryHref: string;
  counts: Record<MemoryFilterValue, number>;
};

export function MemoryFilters({
  activeFilter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  newMemoryHref,
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

      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('searchSpaceMemory')}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          className="w-full"
        />
        <Button
          asChild
          variant="default"
          colorVariant="accent"
          className="w-full lg:w-auto"
        >
          <Link href={newMemoryHref} scroll={false}>
            {t('newMemory')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

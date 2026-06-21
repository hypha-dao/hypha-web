'use client';
import { Input, Button } from '@hypha-platform/ui';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@hypha-platform/ui-utils';
import React from 'react';
import { useDebouncedCallback } from 'use-debounce';

type Suggestion = {
  title: string;
};

type SpaceSearchProps = {
  suggestions?: Suggestion[];
  value?: string;
  className?: string;
  /** Renders inside the search field border (e.g. sort dropdown on My Spaces). */
  suffix?: React.ReactNode;
};

export const SpaceSearch = ({
  suggestions,
  value,
  className,
  suffix,
}: SpaceSearchProps) => {
  const t = useTranslations('Network');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set('query', term);
    } else {
      params.delete('query');
    }
    replace(`${pathname}?${params.toString()}`);
  }, 300);

  React.useEffect(() => {
    return () => {
      handleSearch.cancel();
    };
  }, [handleSearch]);

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      {suffix ? (
        <div className="flex min-h-10 w-full min-w-0 items-center rounded border border-input bg-neutral-1 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <div className="pointer-events-none flex shrink-0 items-center pl-3 text-accent-9">
            <SearchIcon size="16px" />
          </div>
          <input
            type="search"
            placeholder={t('findASpace')}
            defaultValue={value}
            onChange={(e) => handleSearch(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent py-2 pl-3 pr-2 text-2 text-accent-9 caret-accent-9 placeholder:text-accent-9 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="shrink-0 pr-1">{suffix}</div>
        </div>
      ) : (
        <Input
          type="search"
          placeholder={t('findASpace')}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          defaultValue={value}
          onChange={(e) => handleSearch(e.target.value)}
        />
      )}
      {suggestions && (
        <div className="flex items-center justify-center w-full gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion.title}
              className="w-fit h-fit py-1"
              variant="outline"
              colorVariant="neutral"
            >
              {suggestion.title}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

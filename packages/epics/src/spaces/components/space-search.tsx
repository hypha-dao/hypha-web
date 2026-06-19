'use client';
import { Input, Button } from '@hypha-platform/ui';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@hypha-platform/ui-utils';
import { useDebouncedCallback } from 'use-debounce';

type Suggestion = {
  title: string;
};

type SpaceSearchProps = {
  suggestions?: Suggestion[];
  value?: string;
  className?: string;
};

export const SpaceSearch = ({
  suggestions,
  value,
  className,
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

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <Input
        type="search"
        placeholder={t('findASpace')}
        leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
        defaultValue={value}
        onChange={(e) => handleSearch(e.target.value)}
      />
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

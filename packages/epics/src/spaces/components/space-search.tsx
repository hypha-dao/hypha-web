'use client';
import { Input, Button } from '@hypha-platform/ui';
import { SearchIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

type Suggestion = {
  title: string;
};

type SpaceSearchProps = {
  suggestions?: Suggestion[];
  value?: string;
};

export const SpaceSearch = ({ suggestions, value }: SpaceSearchProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();

  const handleSearch = useDebouncedCallback((term: string) => {
    console.log(`Searching... ${term}`);

    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set('query', term);
    } else {
      params.delete('query');
    }
    replace(`${pathname}?${params.toString()}`);
  }, 300);

  return (
    <div className="flex flex-col flex-grow gap-2">
      <Input
        type="search"
        placeholder="Find a Space"
        leftIcon={<SearchIcon size="16px" />}
        value={value}
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

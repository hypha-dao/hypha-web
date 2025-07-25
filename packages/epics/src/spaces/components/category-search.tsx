'use client';

import {
  DisposableLabel,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@hypha-platform/ui';
import { SearchIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

type Suggestion = {
  title: string;
};

type CategorySearchProps = {
  suggestions?: Suggestion[];
};

export function CategorySearch({ suggestions }: CategorySearchProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();

  const currentCategories = React.useMemo(() => {
    const categories = searchParams.has('category')
      ? searchParams.get('category')?.split(',') || []
      : [];
    return categories;
  }, [searchParams]);

  const availableSuggestions = React.useMemo(() => {
    const result =
      suggestions?.filter((suggestion) => {
        return !currentCategories.includes(suggestion.title);
      }) || [];
    return result;
  }, [currentCategories, suggestions]);

  const handleAddCategory = React.useCallback(
    (category: string) => {
      const newCategories = [...currentCategories, category];
      const params = new URLSearchParams(searchParams);
      params.set('category', newCategories.join(','));
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, currentCategories, pathname, replace],
  );

  const handleRemoveCategory = React.useCallback(
    (category: string) => {
      const newCategories = currentCategories.filter((cat) => cat !== category);
      const params = new URLSearchParams(searchParams);
      if (newCategories.length > 0) {
        params.set('category', newCategories.join(','));
      } else {
        params.delete('category');
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, currentCategories, pathname, replace],
  );

  return (
    <div className="flex flex-row flex-grow gap-1 border-1 bg-background rounded-lg p-1 items-start">
      <SearchIcon className="m-2 align-middle" size={16} />
      {currentCategories.map((category) => (
        <DisposableLabel
          key={category}
          label={category}
          closeTooltip="Remove"
          onClose={() => handleRemoveCategory(category)}
        />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Input className="border-0" placeholder="Find a Category" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {availableSuggestions?.map((suggestion) => (
            <DropdownMenuItem
              key={suggestion.title}
              onSelect={() => handleAddCategory(suggestion.title)}
            >
              <span className="capitalize">{suggestion.title}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

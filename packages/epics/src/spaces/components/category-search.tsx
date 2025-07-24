'use client';

import { Category } from '@hypha-platform/core/client';
import {
  DisposableLabel,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@hypha-platform/ui';
import { capitalizeFirstLetter } from '@hypha-platform/ui-utils';
import { SearchIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

type Suggestion = {
  title: string;
};

type SpaceSearchProps = {
  suggestions?: Suggestion[];
};

export function CategorySearch({ suggestions }: SpaceSearchProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();

  const currentCategories = React.useMemo(() => {
    const params = new URLSearchParams(searchParams);
    const categories = params.has('category')
      ? params.get('category')?.split(',') || []
      : [];
    return categories;
  }, [searchParams]);

  const currentCategoriesSet = React.useMemo(
    () => new Set(currentCategories),
    [currentCategories],
  );

  const availableSuggestions = React.useMemo(() => {
    const result =
      suggestions?.filter((suggestion) => {
        return !currentCategoriesSet.has(suggestion.title);
      }) || [];
    return result;
  }, [currentCategoriesSet, suggestions]);

  const handleAddCategory = React.useCallback(
    (category: string) => {
      currentCategoriesSet.add(category);
      const params = new URLSearchParams(searchParams);
      params.set('category', Array.from(currentCategoriesSet).join(','));
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, currentCategoriesSet, pathname],
  );

  const handleRemoveCategory = React.useCallback(
    (category: string) => {
      currentCategoriesSet.delete(category);
      const params = new URLSearchParams(searchParams);
      if (currentCategoriesSet.size > 0) {
        params.set('category', Array.from(currentCategoriesSet).join(','));
      } else {
        params.delete('category');
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, currentCategoriesSet, pathname],
  );

  return (
    <div className="flex flex-row flex-grow gap-1 border-1 bg-background rounded-lg p-1 items-start">
      <SearchIcon className="m-2 align-middle" size={16} />
      {currentCategories.map((category) => (
        <DisposableLabel
          key={category}
          label={capitalizeFirstLetter(category)}
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

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
import { SearchIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback } from 'react';

type Suggestion = {
  title: string;
};

type SpaceSearchProps = {
  categories: Category[];
  suggestions?: Suggestion[];
};

function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function CategorySearch({ categories, suggestions }: SpaceSearchProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();

  const currentCategories = React.useMemo(() => {
    const params = new URLSearchParams(searchParams);
    const categories = params.has('category')
        ? params.get('category')?.split(',') || []
        : [];
    return new Set(categories);
  }, [searchParams]);

  const handleAddCategory = useCallback(
    (category: string) => {
      currentCategories.add(category);
      const params = new URLSearchParams(searchParams);
      params.set('category', Array.from(currentCategories).join(','));
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, currentCategories, pathname],
  );

  const handleRemoveCategory = useCallback(
    (category: string) => {
      currentCategories.delete(category);
      const params = new URLSearchParams(searchParams);
      if (currentCategories.size > 0) {
        params.set('category', Array.from(currentCategories).join(','));
      } else {
        params.delete('category');
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, currentCategories, pathname],
  );

  return (
    <div className="flex flex-row flex-grow gap-1 border-1 bg-background rounded-lg p-1 items-start">
      <SearchIcon className="m-2 align-middle" size={16} />
      {categories.map((category) => (
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
          {suggestions?.map((suggestion) => (
            <DropdownMenuItem
              key={suggestion.title}
              onSelect={() => handleAddCategory(suggestion.title)}
            >
              <span>{suggestion.title}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

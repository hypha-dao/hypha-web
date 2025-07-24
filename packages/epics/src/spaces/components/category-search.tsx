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

  const handleAddCategory = useCallback(
    (category: string) => {
      const params = new URLSearchParams(searchParams);
      const categories = params.has('category')
        ? params.get('category')?.split(',')
        : [];
      const newCategories = new Set(categories);
      newCategories.add(category);
      params.set('category', Array.from(newCategories).join(','));
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname],
  );

  const handleRemoveCategory = useCallback(
    (category: string) => {
      const params = new URLSearchParams(searchParams);
      const categories = params.has('category')
        ? params.get('category')?.split(',')
        : [];
      const newCategories = new Set(categories);
      newCategories.delete(category);
      if (newCategories.size > 0) {
        params.set('category', Array.from(newCategories).join(','));
      } else {
        params.delete('category');
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams],
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

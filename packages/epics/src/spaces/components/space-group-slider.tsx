'use client';

import { Text } from '@radix-ui/themes';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  Button,
} from '@hypha-platform/ui';
import Link from 'next/link';
import { SpaceCard } from './space-card';
import { SpaceCardWithDiscoverability } from './space-card-with-discoverability';
// TODO: #594 declare UI interface separately
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  Space,
} from '@hypha-platform/core/client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

type SpaceGroupSliderProps = {
  spaces?: Space[];
  isLoading?: boolean;
  type?: string;
  getHref: (id: string) => string;
};

export const SpaceGroupSlider = ({
  spaces,
  isLoading,
  type,
  getHref,
}: SpaceGroupSliderProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();

  const seeAllSpaces = useDebouncedCallback((category: string) => {
    const params = new URLSearchParams(searchParams);
    if (category && category.trim()) {
      params.set('category', category);
    } else {
      params.delete('category');
    }
    replace(`${pathname}?${params.toString()}`);
  }, 300);

  return (
    <div className="border-b-2 border-primary-foreground">
      <div className="flex justify-between items-center">
        <Text className="text-4 font-medium capitalize">
          {type} | {spaces?.length}
        </Text>
        <Button
          variant="ghost"
          className="text-accent-11"
          onClick={() => {
            if (type) {
              seeAllSpaces(type);
            }
          }}
        >
          See all
        </Button>
      </div>
      <Carousel className="my-6">
        <CarouselContent>
          {spaces?.map((space) => (
            <CarouselItem
              key={space.title}
              className="w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
            >
              <SpaceCardWithDiscoverability
                space={space}
                getHref={getHref}
                isLoading={isLoading}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

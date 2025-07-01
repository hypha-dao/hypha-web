import { Text } from '@radix-ui/themes';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  Button,
} from '@hypha-platform/ui';
import Link from 'next/link';
import { SpaceCard } from './space-card';
// TODO: #594 declare UI interface separately
import { Space } from '@hypha-platform/core/client';

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
  return (
    <div className="border-b-2 border-primary-foreground pt-6">
      <div className="flex justify-between items-center">
        <Text className="text-4 font-medium capitalize">
          {type} | {spaces?.length}
        </Text>
        <Button variant="ghost" className="text-accent-11">
          See all
        </Button>
      </div>
      <Carousel className="my-6">
        <CarouselContent>
          {spaces?.map((space) => (
            <CarouselItem
              key={space.title}
              className="mb-5 w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
            >
              <Link className="w-96" href={getHref(space.slug as string)}>
                <SpaceCard
                  description={space.description as string}
                  icon={space.logoUrl ?? '/placeholder/space-avatar-image.png'}
                  leadImage={
                    space.leadImage || '/placeholder/space-lead-image.png'
                  }
                  title={space.title as string}
                  isLoading={isLoading}
                  members={space.memberCount}
                  agreements={space.documentCount}
                />
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

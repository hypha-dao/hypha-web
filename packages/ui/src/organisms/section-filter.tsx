import type { FC, ReactNode } from 'react';
import { Text } from '@radix-ui/themes';
import { Input } from '@hypha-platform/ui';
import { SearchIcon } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';

export type FilterOption = {
  label: string;
  value: string;
};

type SectionFilterProps = {
  count?: number | string;
  label: string;
  hasSearch?: boolean;
  searchPlaceholder?: string;
  inlineLabel?: boolean;
  /** Optional mark before the label (e.g. section chevrons). */
  leadingSlot?: ReactNode;
  className?: string;
  onChangeSearch?: (term: string) => void;
  children?: ReactNode;
};

export const SectionFilter: FC<SectionFilterProps> = ({
  count,
  label,
  hasSearch,
  searchPlaceholder = 'Search',
  inlineLabel = true,
  leadingSlot,
  className,
  onChangeSearch,
  children,
}) => {
  return (
    <div className="flex w-full min-h-0 items-center justify-between gap-3 sm:gap-4">
      {inlineLabel ? (
        <>
          {/*
            Shared row height (min-h) + items-center + leading-none keeps the label visually
            centered on the mark (e.g. chevrons in a box) — Radix Text’s default line-height
            can otherwise make the title look vertically offset.
          */}
          <div className="flex min-h-0 min-w-0 shrink-0 items-center gap-2">
            {leadingSlot ? (
              <span className="inline-flex h-8 min-h-8 shrink-0 items-center justify-center self-center px-0.5 text-muted-foreground [&_svg]:size-4">
                {leadingSlot}
              </span>
            ) : null}
            <Text
              as="span"
              className="inline-flex min-h-8 shrink-0 items-center self-center text-4 capitalize leading-tight text-nowrap"
            >
              {label} {count ? <>| {count}</> : null}
            </Text>
          </div>
          {hasSearch ? (
            <Input
              className="min-w-0 flex-1 basis-0 sm:max-w-md lg:max-w-lg"
              placeholder={searchPlaceholder}
              leftIcon={<SearchIcon size="16px" />}
              onChange={(e) => onChangeSearch?.(e.target.value)}
            />
          ) : null}
          {children && (
            <div
              className={cn(
                'flex shrink-0 items-center text-nowrap',
                className,
              )}
            >
              {children}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="w-full flex flex-col gap-4">
            <div className="flex flex-row w-full">
              <Text className="text-4 capitalize text-nowrap">
                {label} {count ? <>| {count}</> : null}
              </Text>
              {children && (
                <div className={cn('flex items-center text-nowrap', className)}>
                  {children}
                </div>
              )}
            </div>
            <div className="flex flex-row w-full">
              {hasSearch ? (
                <Input
                  className="w-full"
                  placeholder={searchPlaceholder}
                  leftIcon={<SearchIcon size="16px" />}
                  onChange={(e) => onChangeSearch?.(e.target.value)}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

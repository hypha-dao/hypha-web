import { FC } from 'react';
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
  className?: string;
  onChangeSearch?: (term: string) => void;
  children?: React.ReactNode;
};

export const SectionFilter: FC<SectionFilterProps> = ({
  count,
  label,
  hasSearch,
  searchPlaceholder = 'Search',
  inlineLabel = true,
  className,
  onChangeSearch,
  children,
}) => {
  const hasLabel = label.trim().length > 0;
  const hasCount = count !== undefined && count !== null;
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3 sm:gap-4">
      {inlineLabel ? (
        <>
          {hasLabel ? (
            <Text className="min-w-0 shrink text-4 capitalize text-nowrap">
              {label} {hasCount ? <>| {count}</> : null}
            </Text>
          ) : null}
          {hasSearch ? (
            <Input
              type="search"
              className="w-full min-w-0 flex-1 basis-[12rem]"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
              onChange={(e) => onChangeSearch?.(e.target.value)}
              // Prevent parent keyboard handlers (e.g. Radix Tabs) from hijacking typing.
              onKeyDown={(e) => e.stopPropagation()}
            />
          ) : null}
          {children && (
            <div
              className={cn(
                // Size to controls; wrap whole control groups — never stretch a
                // checkbox label into a skinny crushed column.
                'flex w-auto max-w-full flex-wrap items-center gap-x-3 gap-y-2',
                className,
              )}
            >
              {children}
            </div>
          )}
        </>
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-4">
          {hasLabel ? (
            <Text className="text-4 capitalize text-nowrap">
              {label} {hasCount ? <>| {count}</> : null}
            </Text>
          ) : null}
          {hasSearch || children ? (
            <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {hasSearch ? (
                <Input
                  type="search"
                  className="w-full min-w-0 flex-1"
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  leftIcon={
                    <SearchIcon className="text-accent-9" size="16px" />
                  }
                  onChange={(e) => onChangeSearch?.(e.target.value)}
                  // Prevent parent keyboard handlers (e.g. Radix Tabs) from hijacking typing.
                  onKeyDown={(e) => e.stopPropagation()}
                />
              ) : null}
              {children ? (
                <div
                  className={cn(
                    'flex w-auto max-w-full flex-wrap items-center gap-x-3 gap-y-2',
                    className,
                  )}
                >
                  {children}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

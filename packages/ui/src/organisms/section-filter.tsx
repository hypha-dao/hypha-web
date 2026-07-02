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
    <div className="flex w-full flex-col gap-3 sm:gap-4">
      {inlineLabel ? (
        <div className="flex w-full flex-col gap-3 min-[720px]:flex-row min-[720px]:flex-wrap min-[720px]:items-center min-[720px]:justify-between">
          {hasLabel ? (
            <Text className="text-3 min-[480px]:text-4 capitalize shrink-0">
              {label} {hasCount ? <>| {count}</> : null}
            </Text>
          ) : null}
          {hasSearch ? (
            <Input
              type="search"
              className="w-full min-[720px]:min-w-[12rem] min-[720px]:max-w-md min-[720px]:flex-1"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
              onChange={(e) => onChangeSearch?.(e.target.value)}
              // Prevent parent keyboard handlers (e.g. Radix Tabs) from hijacking typing.
              onKeyDown={(e) => e.stopPropagation()}
            />
          ) : null}
          {children ? (
            <div
              className={cn(
                'flex w-full min-[720px]:w-auto items-center shrink-0',
                className,
              )}
            >
              {children}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex w-full flex-col gap-3">
          {hasLabel ? (
            <Text className="text-3 min-[480px]:text-4 capitalize">
              {label} {hasCount ? <>| {count}</> : null}
            </Text>
          ) : null}
          {hasSearch ? (
            <Input
              type="search"
              className="w-full"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
              onChange={(e) => onChangeSearch?.(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          ) : null}
          {children ? (
            <div className={cn('flex w-full items-center', className)}>
              {children}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

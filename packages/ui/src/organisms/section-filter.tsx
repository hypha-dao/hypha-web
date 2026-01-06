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
  return (
    <div className="flex justify-between items-center w-full gap-4">
      {inlineLabel ? (
        <>
          <Text className="text-4 capitalize text-nowrap">
            {label} {count ? <>| {count}</> : null}
          </Text>
          {hasSearch ? (
            <Input
              className="w-full"
              placeholder={searchPlaceholder}
              leftIcon={<SearchIcon size="16px" />}
              onChange={(e) => onChangeSearch?.(e.target.value)}
            />
          ) : null}
          {children && (
            <div className={cn('flex items-center text-nowrap', className)}>
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

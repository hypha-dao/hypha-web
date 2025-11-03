import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { Input } from '@hypha-platform/ui';
import { SearchIcon } from 'lucide-react';

export type FilterOption = {
  label: string;
  value: string;
};

type SectionFilterProps = {
  count?: number | string;
  label: string;
  children?: React.ReactNode;
  hasSearch?: boolean;
  searchPlaceholder?: string;
  onChangeSearch?: (term: string) => void;
};

export const SectionFilter: FC<SectionFilterProps> = ({
  count,
  label,
  children,
  hasSearch,
  searchPlaceholder = 'Search',
  onChangeSearch,
}) => {
  return (
    <div className="flex justify-between items-center w-full gap-4">
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
        <div className="flex items-center text-nowrap">{children}</div>
      )}
    </div>
  );
};

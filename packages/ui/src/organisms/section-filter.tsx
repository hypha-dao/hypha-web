import { FC } from 'react';
import { FilterMenu } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';

type FilterOption = {
  label: string;
  value: string;
};

type SectionFilterProps = {
  value: string;
  onChange: (value: string) => void;
  count: number;
  label: string;
  filterOptions: FilterOption[];
};

export const SectionFilter: FC<SectionFilterProps> = ({
  value,
  onChange,
  count,
  label,
  filterOptions,
}) => {
  return (
    <div className="flex justify-between items-center mt-6 w-full">
      <Text className="text-lg">
        {label} | {count}
      </Text>
      <div className="flex items-center">
        <FilterMenu value={value} onChange={onChange} options={filterOptions} />
      </div>
    </div>
  );
};

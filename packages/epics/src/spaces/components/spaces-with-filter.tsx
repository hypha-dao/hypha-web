import { Text } from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';
import { Locale } from '@hypha-platform/i18n';
import { Button, FilterMenu } from '@hypha-platform/ui';
import Link from 'next/link';
import { Space } from '@core/space';
import { UseMembers, SpaceCardList } from '@hypha-platform/epics';

type OptionType = {
  label: string;
  value: string;
};

type SpacesFilterType = {
  value: string;
  options: OptionType[];
};

export function SpacesWithFilter({
  lang,
  spaces,
  useMembers,
  handleChangeFilter,
}: {
  lang: Locale;
  spaces: Space[];
  useMembers: UseMembers;
  handleChangeFilter?: (value: string) => void;
}) {
  const filterSettings: SpacesFilterType = {
    value: 'all',
    options: [
      { label: 'All', value: 'all' },
      { label: 'My Spaces', value: 'my-spaces' },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="justify-between items-center flex">
        <Text className="text-4">My spaces | {spaces.length}</Text>
        <div className="flex items-center">
          <FilterMenu
            value={filterSettings.value}
            options={filterSettings.options}
            onChange={handleChangeFilter}
          />
          <Link href={`/${lang}/my-spaces/create`} scroll={false}>
            <Button className="ml-2">
              <PlusIcon className="mr-2" />
              Create Space
            </Button>
          </Link>
        </div>
      </div>
      <SpaceCardList lang={lang} spaces={spaces} useMembers={useMembers} />
    </div>
  );
}

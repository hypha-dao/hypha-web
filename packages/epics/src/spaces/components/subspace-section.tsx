import { Text } from '@radix-ui/themes';
import { FilterMenu, Button } from '@hypha-platform/ui';
import Link from 'next/link';
import { PlusIcon } from '@radix-ui/react-icons';
import { InnerSpaceCard } from '@hypha-platform/epics';
import { Space } from '@core/space';
import { Locale } from '@hypha-platform/i18n';

interface SubspaceSectionProps {
  getDhoPathAgreements: (lang: Locale, id: string) => string;
  spaces: Space[];
  lang: Locale;
}

type OptionType = {
  label: string;
  value: string;
};

type SpacesFilterType = {
  value: string;
  options: OptionType[];
};

const filterSettings: SpacesFilterType = {
  value: 'most-recent',
  options: [
    { label: 'All', value: 'all' },
    { label: 'Most recent', value: 'most-recent' },
  ],
};

export const SubspaceSection = ({
  spaces,
  lang,
  getDhoPathAgreements,
}: SubspaceSectionProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="justify-between items-center flex">
        <Text className="text-4">Sub-spaces | {spaces.length}</Text>
        <div className="flex items-center">
          <FilterMenu
            value={filterSettings.value}
            options={filterSettings.options}
          />
          <Link href={`membership/space/create`} scroll={false}>
            <Button className="ml-2">
              <PlusIcon className="mr-2" />
              Create
            </Button>
          </Link>
        </div>
      </div>
      {!spaces.length ? (
        <span className="text-2 text-center text-neutral-11">
          {' '}
          No sub-spaces
        </span>
      ) : (
        <div
          data-testid="sub-spaces-container"
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {spaces.map((space) => (
            <div key={space.id} className="mb-1">
              <Link href={getDhoPathAgreements(lang, space.slug as string)}>
                <InnerSpaceCard
                  description={space.description as string}
                  leadImageUrl={
                    space.leadImage || '/placeholder/space-lead-image.png'
                  }
                  title={space.title}
                  members={[
                    {
                      avatar: 'https://github.com/shadcn.png',
                      name: 'Jane',
                      surname: 'Doe',
                    },
                    {
                      avatar: 'https://github.com/shadcn.png',
                      name: 'Jane',
                      surname: 'Doe',
                    },
                  ]}
                  spaceId={space.web3SpaceId}
                />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

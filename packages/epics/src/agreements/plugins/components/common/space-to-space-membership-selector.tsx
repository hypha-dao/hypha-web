'use client';

import { useMemo, useCallback } from 'react';
import { Image, Combobox } from '@hypha-platform/ui';
import { Space, Person } from '@hypha-platform/core/client';
import { useFilterSpacesListWithDiscoverability } from '@hypha-platform/epics';

type SpaceToSpaceMembershipSelectorProps = {
  memberOptions?: Person[];
  spaceOptions?: Space[];
  value?: string;
  onChange?: (selected: Person | Space | null) => void;
};

export const SpaceToSpaceMembershipSelector = ({
  memberOptions = [],
  spaceOptions = [],
  onChange,
  value,
}: SpaceToSpaceMembershipSelectorProps) => {
  const { filteredSpaces } = useFilterSpacesListWithDiscoverability({
    spaces: spaceOptions,
    useGeneralState: true,
  });

  const isSpace = filteredSpaces.length > 0 && memberOptions.length === 0;
  const placeholder = isSpace ? 'Find Space' : 'Find Member';
  const title = isSpace ? 'Space to join' : 'Delegated Voting Member';

  const options = useMemo(() => {
    const memberItems = memberOptions.map((member) => ({
      value: String(member.address),
      label: `${member.name} ${member.surname}`,
      searchText: `${member.name} ${member.surname}`.toLowerCase(),
      avatarUrl: member.avatarUrl,
      address: member.address,
    }));

    const spaceItems = filteredSpaces.map((space) => ({
      value: String(space.address),
      label: space.title,
      searchText: space.title.toLowerCase(),
      avatarUrl: space.logoUrl,
      address: space.address,
    }));

    return [...spaceItems, ...memberItems];
  }, [memberOptions, filteredSpaces]);

  const handleChange = useCallback(
    (value: string) => {
      const found = options.find((option) => option.value === value);
      if (found) {
        const source = [...memberOptions, ...filteredSpaces];
        const originalItem = source.find(
          (item) => item.address === found.value,
        );
        onChange?.(originalItem || null);
      } else {
        onChange?.(null);
      }
    },
    [options, memberOptions, filteredSpaces, onChange],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 w-full justify-between">
        <label className="text-2 text-neutral-11 w-full">{title}</label>
        <div className="min-w-72 w-full">
          <Combobox
            options={options}
            placeholder={placeholder}
            onChange={handleChange}
            initialValue={value}
            renderOption={(option) => (
              <>
                {typeof option.avatarUrl === 'string' && (
                  <Image
                    src={option.avatarUrl}
                    alt={option.label}
                    width={24}
                    height={24}
                    className="rounded-full min-h-5"
                  />
                )}
                <span className="text-ellipsis overflow-hidden text-nowrap">
                  {option.label}
                </span>
              </>
            )}
            renderValue={(option) =>
              option ? (
                <div className="flex items-center gap-2 truncate">
                  {typeof option.avatarUrl === 'string' && (
                    <Image
                      src={option.avatarUrl}
                      alt={option.label}
                      width={24}
                      height={24}
                      className="rounded-full min-h-5"
                    />
                  )}
                  <span className="truncate text-ellipsis overflow-hidden text-nowrap">
                    {option.label}
                  </span>
                </div>
              ) : (
                placeholder
              )
            }
          />
        </div>
      </div>
    </div>
  );
};

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Image, Combobox } from '@hypha-platform/ui';
import { Space, Person } from '@hypha-platform/core/client';

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
  const [selected, setSelected] = useState<Person | Space | null>(null);

  useEffect(() => {
    if (value) {
      const foundMember = memberOptions.find((r) => r.address === value);
      const foundSpace = spaceOptions.find((s) => s.address === value);
      setSelected(foundMember || foundSpace || null);
    }
  }, [value, memberOptions, spaceOptions]);
  const isSpace = spaceOptions.length > 0 && memberOptions.length === 0;
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

    const spaceItems = spaceOptions.map((space) => ({
      value: String(space.address),
      label: space.title,
      searchText: space.title.toLowerCase(),
      avatarUrl: space.logoUrl,
      address: space.address,
    }));

    return [...spaceItems, ...memberItems];
  }, [memberOptions, spaceOptions]);

  const handleChange = useCallback(
    (value: string) => {
      const found = options.find((option) => option.value === value);
      if (found) {
        const source = [...memberOptions, ...spaceOptions];
        const originalItem = source.find(
          (item) => item.address === found.value,
        );
        setSelected(originalItem || null);
        onChange?.(originalItem || null);
      } else {
        setSelected(null);
        onChange?.(null);
      }
    },
    [options, memberOptions, spaceOptions, onChange],
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
                {option.avatarUrl && (
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
                  {option.avatarUrl && (
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

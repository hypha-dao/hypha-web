'use client';

import { useMemo, useCallback } from 'react';
import { Image, Combobox } from '@hypha-platform/ui';
import { Person } from '@hypha-platform/core/client';

type DelegatedMemberProps = {
  members?: Person[];
  value?: string;
  onChange?: (selected: Person | null) => void;
  readOnly?: boolean;
};

export const DelegatedMemberSelector = ({
  members = [],
  onChange,
  value,
  readOnly,
}: DelegatedMemberProps) => {
  const placeholder = 'Find Member';

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        value: String(member.address),
        label: `${member.name} ${member.surname}`,
        searchText: `${member.name} ${member.surname}`.toLowerCase(),
        avatarUrl: member.avatarUrl,
        address: member.address,
      })),
    [members],
  );

  const handleChange = useCallback(
    (value?: string | null) => {
      if (readOnly) return;

      if (!value) {
        onChange?.(null);
        return;
      }

      const found = memberOptions.find((option) => option.value === value);

      if (found) {
        const originalItem = members.find(
          (item) => item.address === found.value,
        );
        if (originalItem) {
          onChange?.(originalItem);
        } else {
          onChange?.(null);
        }
      } else {
        onChange?.(null);
      }
    },
    [memberOptions, members, onChange, readOnly],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="min-w-72 w-full">
        <Combobox
          options={memberOptions}
          placeholder={placeholder}
          onChange={handleChange}
          initialValue={value || undefined}
          disabled={readOnly}
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
  );
};

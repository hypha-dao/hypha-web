'use client';

import { useMemo, useCallback } from 'react';
import { Image, Combobox } from '@hypha-platform/ui';
import { Space } from '@hypha-platform/core/client';

type DelegatedSpaceSelectorProps = {
  spaces?: Space[];
  value?: number;
  onChange?: (selected: Space | null) => void;
  readOnly?: boolean;
};

export const DelegatedSpaceSelector = ({
  spaces = [],
  onChange,
  value,
  readOnly,
}: DelegatedSpaceSelectorProps) => {
  const placeholder = 'Find Space';

  const spaceOptions = useMemo(
    () =>
      spaces.map((space) => ({
        value: String(space.web3SpaceId),
        label: space.title,
        searchText: space.title.toLowerCase(),
        avatarUrl: space.logoUrl,
      })),
    [spaces],
  );

  const handleChange = useCallback(
    (value?: string | null) => {
      if (readOnly) return;

      if (!value) {
        onChange?.(null);
        return;
      }

      const id = Number(value);
      if (Number.isNaN(id)) {
        onChange?.(null);
        return;
      }

      const originalItem = spaces.find((item) => item.web3SpaceId === id);
      onChange?.(originalItem ?? null);
    },
    [spaces, onChange, readOnly],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="min-w-72 w-full">
        <Combobox
          options={spaceOptions}
          placeholder={placeholder}
          onChange={handleChange}
          initialValue={value != null ? String(value) : undefined}
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

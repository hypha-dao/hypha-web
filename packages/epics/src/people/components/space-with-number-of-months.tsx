'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Combobox, Input, Image, Separator } from '@hypha-platform/ui';
import { DEFAULT_SPACE_AVATAR_IMAGE, Space } from '@hypha-platform/core/client';

type SpaceWithMonthsValue = {
  spaceId: number;
  months: number;
};

type SpaceWithNumberOfMonthsFieldProps = {
  spaces?: Space[];
  value?: SpaceWithMonthsValue;
  onChange?: (value: SpaceWithMonthsValue) => void;
};

export const SpaceWithNumberOfMonthsField = ({
  spaces = [],
  value,
  onChange,
}: SpaceWithNumberOfMonthsFieldProps) => {
  const [selected, setSelected] = useState<Space | null>(null);
  const [months, setMonths] = useState<number>(0);

  useEffect(() => {
    if (value) {
      const found = spaces.find((s) => s.web3SpaceId === value.spaceId) || null;
      setSelected(found);
      setMonths(value.months ?? 0);
    }
  }, [value, spaces]);

  const options = useMemo(
    () =>
      spaces.map((space) => ({
        value: String(space.web3SpaceId),
        label: space.title,
        avatarUrl: space.logoUrl,
      })),
    [spaces],
  );

  const handleSpaceChange = useCallback(
    (selectedId: string) => {
      const selectedWeb3Id = Number(selectedId);
      const foundSpace =
        spaces.find((s) => s.web3SpaceId === selectedWeb3Id) || null;
      setSelected(foundSpace);
      if (foundSpace) {
        onChange?.({
          spaceId: foundSpace.web3SpaceId as number,
          months,
        });
      }
    },
    [spaces, months, onChange],
  );

  const handleMonthsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = Number(e.target.value);
      const nextMonths = Number.isNaN(rawValue) ? 0 : rawValue;
      setMonths(nextMonths);
      if (selected) {
        onChange?.({
          spaceId: selected.web3SpaceId as number,
          months: nextMonths,
        });
      }
    },
    [selected, onChange],
  );

  return (
    <>
      <div className="flex flex-col gap-5 w-full">
        <div className="flex w-full justify-between items-center">
          <span className="text-2 text-neutral-11 w-full">Space Selector</span>
          <Combobox
            options={options}
            placeholder="Select space..."
            onChange={handleSpaceChange}
            renderOption={(option) => (
              <>
                <Image
                  src={option.avatarUrl || DEFAULT_SPACE_AVATAR_IMAGE}
                  alt={option.label}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
                <span>{option.label}</span>
              </>
            )}
            renderValue={(option) =>
              option ? (
                <div className="flex items-center gap-2 truncate">
                  <Image
                    src={option.avatarUrl || DEFAULT_SPACE_AVATAR_IMAGE}
                    alt={option.label}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                  <span className="truncate">{option.label}</span>
                </div>
              ) : (
                'Search spaces...'
              )
            }
          />
        </div>
        <div className="flex w-full justify-between items-center">
          <span className="text-2 text-neutral-11 w-full">
            Number of Months
          </span>
          <Input
            type="number"
            placeholder="Type an amount"
            value={months}
            onChange={handleMonthsChange}
            min={0}
          />
        </div>
      </div>
      <Separator />
    </>
  );
};

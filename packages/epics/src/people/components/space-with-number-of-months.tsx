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
  const [months, setMonths] = useState<string>('');

  useEffect(() => {
    if (value) {
      const found = spaces.find((s) => s.web3SpaceId === value.spaceId) || null;
      setSelected(found);
      setMonths(String(value.months ?? ''));
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
    (selectedId: string | null) => {
      if (!selectedId) {
        setSelected(null);
        onChange?.({
          spaceId: 0,
          months: 0,
        });
        return;
      }

      const selectedWeb3Id = Number(selectedId);
      const foundSpace =
        spaces.find((s) => s.web3SpaceId === selectedWeb3Id) || null;

      setSelected(foundSpace);

      if (foundSpace && months !== '') {
        const numericMonths = Number(months);
        if (!Number.isNaN(numericMonths)) {
          onChange?.({
            spaceId: foundSpace.web3SpaceId as number,
            months: numericMonths,
          });
        }
      }
    },
    [spaces, months, onChange],
  );

  const handleMonthsChange = useCallback(
    (input: string) => {
      if (/^\d*$/.test(input)) {
        setMonths(input);
        const numeric = input === '' ? 0 : Number(input);

        if (!Number.isNaN(numeric) && selected) {
          onChange?.({
            spaceId: selected.web3SpaceId as number,
            months: numeric,
          });
        }
      }
    },
    [selected, onChange],
  );

  return (
    <>
      <div className="flex flex-col gap-5 w-full">
        <div className="flex w-full justify-between items-center">
          <span className="text-2 text-neutral-11 w-full">Select Space</span>
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
                'Find Space'
              )
            }
          />
        </div>
        <div className="flex w-full justify-between items-center">
          <span className="text-2 text-neutral-11 w-full">
            Number of Months
          </span>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Type an amount"
            value={months}
            onChange={(e) => handleMonthsChange(e.target.value)}
            min={0}
          />
        </div>
      </div>
      <Separator />
    </>
  );
};

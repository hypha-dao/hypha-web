'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Combobox,
  Input,
  Image,
  Separator,
  COMBOBOX_TITLE,
  COMBOBOX_DELIMITER,
} from '@hypha-platform/ui';
import { DEFAULT_SPACE_AVATAR_IMAGE, Space } from '@hypha-platform/core/client';
import { useFormContext } from 'react-hook-form';

type SpaceWithMonthsValue = {
  spaceId: number;
  months: number;
};

type SpaceWithNumberOfMonthsFieldProps = {
  spaces?: Space[];
  organisationSpaces: Space[];
  value?: SpaceWithMonthsValue;
  onChange?: (value: SpaceWithMonthsValue) => void;
  name?: string;
};

type SpaceOption = { avatarUrl?: string | null; value: string; label: string };

export const SpaceWithNumberOfMonthsField = ({
  spaces = [],
  organisationSpaces,
  value,
  onChange,
  name,
}: SpaceWithNumberOfMonthsFieldProps) => {
  const [selected, setSelected] = useState<Space | null>(null);
  const [months, setMonths] = useState<string>('');

  const { setValue, trigger } = useFormContext();

  useEffect(() => {
    if (value) {
      const found =
        organisationSpaces.find((s) => s.web3SpaceId === value.spaceId) ||
        spaces.find((s) => s.web3SpaceId === value.spaceId) ||
        null;
      setSelected(found);
      setMonths(String(value.months ?? ''));
    }
  }, [value, spaces, organisationSpaces]);

  const options = useMemo(() => {
    if (organisationSpaces.length === 0) {
      return spaces.map((space) => ({
        value: String(space.web3SpaceId),
        label: space.title,
        avatarUrl: space.logoUrl,
      }));
    }
    const organisationOptions = organisationSpaces.map((space) => ({
      avatarUrl: space.logoUrl,
      value: String(space.web3SpaceId),
      label: space.title,
    }));
    const mySpacesOptions = spaces
      .filter(
        (space) =>
          !organisationSpaces.find((orgSpace) => space.id === orgSpace.id),
      )
      .map((space) => {
        return {
          avatarUrl: space.logoUrl,
          value: String(space.web3SpaceId),
          label: space.title,
        };
      });
    const result: SpaceOption[] = [];
    if (organisationOptions.length > 0) {
      result.push(
        { value: COMBOBOX_TITLE, label: 'Organisation Spaces' },
        ...organisationOptions,
      );
    }
    if (organisationOptions.length > 0 && mySpacesOptions.length > 0) {
      result.push({
        value: COMBOBOX_DELIMITER,
        label: '',
      });
    }
    if (mySpacesOptions.length > 0) {
      result.push(
        { value: COMBOBOX_TITLE, label: 'Other Spaces' },
        ...mySpacesOptions,
      );
    }
    return result;
  }, [spaces, organisationSpaces]);

  const handleSpaceChange = useCallback(
    (selectedId: string | null) => {
      const currentMonths = months === '' ? 0 : Number(months);

      if (!selectedId) {
        setSelected(null);
        if (name) {
          setValue(`${name}.spaceId`, 0, {
            shouldDirty: true,
            shouldValidate: true,
          });
          setValue(`${name}.months`, currentMonths, {
            shouldDirty: true,
            shouldValidate: true,
          });
          trigger(`${name}.spaceId`);
        } else {
          onChange?.({ spaceId: 0, months: currentMonths });
        }
        return;
      }

      const selectedWeb3Id = Number(selectedId);
      const foundSpace =
        spaces.find((s) => s.web3SpaceId === selectedWeb3Id) || null;

      setSelected(foundSpace);

      if (name) {
        setValue(`${name}.spaceId`, selectedWeb3Id, {
          shouldDirty: true,
          shouldValidate: true,
        });
        setValue(`${name}.months`, currentMonths, {
          shouldDirty: true,
          shouldValidate: true,
        });
        trigger(`${name}.months`);
        trigger(`${name}.spaceId`);
      } else {
        if (foundSpace) {
          const numericMonths = Number(months || 0);
          onChange?.({
            spaceId: foundSpace.web3SpaceId as number,
            months: numericMonths,
          });
        }
      }
    },
    [spaces, months, onChange, name, setValue, trigger],
  );

  const handleMonthsChange = useCallback(
    (input: string) => {
      if (/^\d*$/.test(input)) {
        setMonths(input);
        const numeric = input === '' ? 0 : Number(input);

        if (name) {
          setValue(`${name}.months`, numeric, {
            shouldDirty: true,
            shouldValidate: true,
          });
          trigger(`${name}.spaceId`);
        } else {
          if (!Number.isNaN(numeric) && selected) {
            onChange?.({
              spaceId: selected.web3SpaceId as number,
              months: numeric,
            });
          } else {
            onChange?.({
              spaceId: selected?.web3SpaceId ?? 0,
              months: numeric,
            });
          }
        }
      }
    },
    [selected, onChange, name, setValue, trigger],
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

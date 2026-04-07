'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Image, Combobox, Input } from '@hypha-platform/ui';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  Person,
} from '@hypha-platform/core/client';

type MemberWithNumberValue = {
  member: string;
  number: number;
};

type MemberWithNumberFieldProps = {
  members?: Person[];
  value?: MemberWithNumberValue;
  onChange?: (value: MemberWithNumberValue) => void;
};

export const MemberWithNumberField = ({
  members = [],
  onChange,
  value,
}: MemberWithNumberFieldProps) => {
  const [selected, setSelected] = useState<Person | null>(null);
  const [number, setNumber] = useState<number>(0);

  useEffect(() => {
    if (value) {
      const found = members.find((m) => m.address === value.member) || null;
      setSelected(found);
      setNumber(value.number ?? 0);
    }
  }, [value, members]);

  const placeholder = 'Select member...';

  const options = useMemo(
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

  const handleMemberChange = useCallback(
    (selectedAddress: string) => {
      const foundMember =
        members.find((m) => m.address === selectedAddress) || null;
      setSelected(foundMember);
      onChange?.({
        member: foundMember?.address || '',
        number,
      });
    },
    [members, number, onChange],
  );

  const handleNumberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = Number(e.target.value);
      const nextNumber = Number.isNaN(rawValue) ? 0 : rawValue;
      setNumber(nextNumber);
      onChange?.({
        member: selected?.address || '',
        number: nextNumber,
      });
    },
    [selected, onChange],
  );

  return (
    <div className="flex gap-2 items-center">
      <div className="flex-1">
        <Combobox
          className="max-w-[190px]"
          options={options}
          placeholder={placeholder}
          onChange={handleMemberChange}
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
              placeholder
            )
          }
        />
      </div>

      <Input
        type="number"
        placeholder="Number"
        value={number}
        onChange={handleNumberChange}
        min={0}
      />
    </div>
  );
};

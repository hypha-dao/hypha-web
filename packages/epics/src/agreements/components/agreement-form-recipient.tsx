'use client';

import { useState, useMemo, useCallback } from 'react';
import { Image, Combobox } from '@hypha-platform/ui';

type Member = {
  name: string;
  surname: string;
  avatarUrl: string;
  id: number;
};

type Props = {
  members?: Member[];
  onChange?: (selected: Member) => void;
};

export const AgreementFormRecipient = ({ members = [], onChange }: Props) => {
  const [selected, setSelected] = useState<Member | null>(null);

  const placeholder = 'Select recipient...';

  const options = useMemo(
    () =>
      members.map((member) => ({
        value: `${member.name} ${member.surname}`,
        label: `${member.name} ${member.surname}`,
        avatarUrl: member.avatarUrl,
      })),
    [members],
  );

  const handleChange = useCallback(
    (value: string) => {
      const found =
        members.find((m) => `${m.name} ${m.surname}` === value) || null;
      setSelected(found);
      onChange?.(found!);
    },
    [members, onChange],
  );

  return (
    <div className="flex w-full justify-between items-center gap-2">
      <label className="text-sm text-neutral-11">Recipient</label>

      <div className="flex items-center gap-2 min-w-[220px]">
        <Combobox
          options={options}
          placeholder={placeholder}
          onChange={handleChange}
          renderOption={(option) => (
            <>
              <Image
                src={option.avatarUrl}
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
                  src={option.avatarUrl}
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
    </div>
  );
};

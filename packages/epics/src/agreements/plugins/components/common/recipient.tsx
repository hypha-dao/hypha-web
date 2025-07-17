'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Image, Combobox } from '@hypha-platform/ui';
import { WalletAddress } from './wallet-address';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import { Space, Person } from '@hypha-platform/core/client';

type RecipientProps = {
  subspaces?: Space[];
  members?: Person[];
  value?: string;
  onChange?: (selected: Person | Space | { address: string }) => void;
};

export const Recipient = ({
  members = [],
  subspaces = [],
  onChange,
  value,
}: RecipientProps) => {
  const [recipientType, setRecipientType] = useState<'member' | 'space'>(
    'member',
  );
  const [selected, setSelected] = useState<
    Person | Space | { address: string } | null
  >(null);
  const [manualAddress, setManualAddress] = useState(value || '');

  useEffect(() => {
    if (value) {
      const foundMember = members.find((r) => r.address === value);
      const foundSpace = subspaces.find((s) => s.address === value);
      setSelected(foundMember || foundSpace || { address: value });
      setManualAddress(value);
    }
  }, [value, members, subspaces]);

  const placeholder = 'Select recipient...';

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        value: String(member.address),
        label: `${member.name} ${member.surname}`,
        avatarUrl: member.avatarUrl,
        address: member.address,
      })),
    [members],
  );

  const spaceOptions = useMemo(
    () =>
      subspaces.map((space) => ({
        value: String(space.address),
        label: space.title,
        avatarUrl: space.logoUrl,
        address: space.address,
      })),
    [subspaces],
  );

  const currentOptions =
    recipientType === 'member' ? memberOptions : spaceOptions;

  const handleChange = useCallback(
    (value: string) => {
      const lowerValue = value.toLowerCase();
      const source = recipientType === 'member' ? members : subspaces;

      const found =
        source.find(
          (item) =>
            String(item.address).toLowerCase() === lowerValue ||
            ('name' in item && item?.name?.toLowerCase() === lowerValue) ||
            ('surname' in item &&
              item?.surname?.toLowerCase() === lowerValue) ||
            ('title' in item && item.title.toLowerCase() === lowerValue),
        ) || null;

      setSelected(found);
      if (found) {
        setManualAddress(found.address || '');
        onChange?.(found);
      }
    },
    [members, subspaces, recipientType, onChange],
  );

  const handleAddressChange = useCallback(
    (address: string) => {
      setManualAddress(address);
      const foundMember = members.find((r) => r.address === address);
      const foundSpace = subspaces.find((s) => s.address === address);

      if (foundMember || foundSpace) {
        setSelected(foundMember || foundSpace || null);
        onChange?.(foundMember || foundSpace!);
      } else {
        setSelected(null);
        onChange?.({ address });
      }
    },
    [members, subspaces, onChange],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full justify-between items-center">
        <label className="text-sm text-neutral-11">Recipient</label>
        <div className="flex gap-2 items-center">
          <Tabs
            value={recipientType}
            onValueChange={(value) =>
              setRecipientType(value as 'member' | 'space')
            }
            className="ml-4"
          >
            <TabsList>
              <TabsTrigger value="member">Member</TabsTrigger>
              <TabsTrigger value="space">Space</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2 min-w-[220px]">
            <Combobox
              options={currentOptions}
              placeholder={placeholder}
              onChange={handleChange}
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
      <WalletAddress address={manualAddress} onChange={handleAddressChange} />
    </div>
  );
};

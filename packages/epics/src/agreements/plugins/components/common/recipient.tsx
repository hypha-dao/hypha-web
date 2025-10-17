'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Image, Combobox } from '@hypha-platform/ui';
import { WalletAddress } from './wallet-address';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import { Space, Person } from '@hypha-platform/core/client';

export type RecipientType = 'member' | 'space';

type RecipientProps = {
  spaces?: Space[];
  members?: Person[];
  value?: string;
  defaultRecipientType?: RecipientType;
  onChange?: (selected: Person | Space | { address: string }) => void;
  readOnly?: boolean;
  emptyMembersMessage?: string;
  emptySpacesMessage?: string;
  label?: string;
  showTabs?: boolean;
};

export const Recipient = ({
  members = [],
  spaces = [],
  onChange,
  value,
  defaultRecipientType = 'member',
  readOnly,
  emptyMembersMessage,
  emptySpacesMessage,
  label = 'Recipient',
  showTabs = true,
}: RecipientProps) => {
  const [recipientType, setRecipientType] =
    useState<RecipientType>(defaultRecipientType);
  const [selected, setSelected] = useState<
    Person | Space | { address: string } | null
  >(null);
  const [manualAddress, setManualAddress] = useState(value || '');

  useEffect(() => {
    if (value) {
      const foundMember = members.find((r) => r.address === value);
      const foundSpace = spaces.find((s) => s.address === value);
      setSelected(foundMember || foundSpace || { address: value });
      setManualAddress(value);
    }
  }, [value, members, spaces]);

  const placeholder =
    recipientType === 'member' ? 'Select member...' : 'Select space...';

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

  const spaceOptions = useMemo(
    () =>
      spaces.map((space) => ({
        value: String(space.address),
        label: space.title,
        searchText: space.title.toLowerCase(),
        avatarUrl: space.logoUrl,
        address: space.address,
      })),
    [spaces],
  );

  const currentOptions =
    recipientType === 'member' ? memberOptions : spaceOptions;

  const handleChange = useCallback(
    (value: string) => {
      if (readOnly) return;
      const found = currentOptions.find((option) => option.value === value);

      if (found) {
        const source = recipientType === 'member' ? members : spaces;
        const originalItem = source.find(
          (item) => item.address === found.value,
        );

        if (originalItem) {
          setSelected(originalItem);
          setManualAddress(originalItem.address || '');
          onChange?.(originalItem);
        }
      }
    },
    [currentOptions, members, spaces, recipientType, onChange, readOnly],
  );

  const handleAddressChange = useCallback(
    (address: string) => {
      if (readOnly) return;
      setManualAddress(address);
      const foundMember = members.find((r) => r.address === address);
      const foundSpace = spaces.find((s) => s.address === address);

      if (foundMember || foundSpace) {
        setSelected(foundMember || foundSpace || null);
        onChange?.(foundMember || foundSpace!);
      } else {
        setSelected(null);
        onChange?.({ address });
      }
    },
    [members, spaces, onChange, readOnly],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center w-full gap-2">
        <div className="flex items-center justify-between gap-2 w-full">
          <label className="text-sm text-neutral-11">{label}</label>
          {showTabs && (
            <Tabs
              value={recipientType}
              onValueChange={(value) =>
                !readOnly && setRecipientType(value as 'member' | 'space')
              }
              disabled={readOnly}
            >
              <TabsList triggerVariant="switch">
                <TabsTrigger variant="switch" value="member">
                  Member
                </TabsTrigger>
                <TabsTrigger variant="switch" value="space">
                  Space
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
        <div className="min-w-72 w-full md:w-auto">
          <Combobox
            options={currentOptions}
            placeholder={placeholder}
            onChange={handleChange}
            initialValue={value}
            disabled={readOnly}
            emptyListMessage={
              recipientType === 'member'
                ? emptyMembersMessage
                : emptySpacesMessage
            }
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
      <WalletAddress
        address={manualAddress}
        onChange={handleAddressChange}
        disabled={readOnly}
      />
    </div>
  );
};

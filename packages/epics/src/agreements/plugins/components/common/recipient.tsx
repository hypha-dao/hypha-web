'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Image, Combobox } from '@hypha-platform/ui';
import { WalletAddress } from './wallet-address';

type Recipient = {
  name: string;
  surname: string;
  avatarUrl: string;
  address: string;
};

type RecipientProps = {
  recipients?: Recipient[];
  value?: string;
  onChange?: (selected: Recipient | { address: string }) => void;
};

export const Recipient = ({
  recipients = [],
  onChange,
  value,
}: RecipientProps) => {
  const [selected, setSelected] = useState<
    Recipient | { address: string } | null
  >(null);
  const [manualAddress, setManualAddress] = useState(value || '');

  useEffect(() => {
    if (value) {
      const found = recipients.find((r) => r.address === value);
      setSelected(found || { address: value });
      setManualAddress(value);
    }
  }, [value, recipients]);

  const placeholder = 'Select recipient...';

  const options = useMemo(
    () =>
      recipients.map((recipient) => ({
        value: String(recipient.address),
        label: `${recipient.name} ${recipient.surname}`,
        avatarUrl: recipient.avatarUrl,
        address: recipient.address,
      })),
    [recipients],
  );

  const handleChange = useCallback(
    (value: string) => {
      const lowerValue = value.toLowerCase();
      const found =
        recipients.find(
          (r) =>
            String(r.address).toLowerCase() === lowerValue ||
            r.name.toLowerCase() === lowerValue ||
            r.surname.toLowerCase() === lowerValue,
        ) || null;

      setSelected(found);
      if (found) {
        setManualAddress(found.address);
        onChange?.(found);
      }
    },
    [recipients, onChange],
  );

  const handleAddressChange = useCallback(
    (address: string) => {
      setManualAddress(address);
      const found = recipients.find((r) => r.address === address);

      if (found) {
        setSelected(found);
        onChange?.(found);
      } else {
        setSelected(null);
        onChange?.({ address });
      }
    },
    [recipients, onChange],
  );

  return (
    <div className="flex flex-col gap-4">
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
      <WalletAddress address={manualAddress} onChange={handleAddressChange} />
    </div>
  );
};

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
  onChange?: (selected: Recipient) => void;
  error?: string;
};

export const Recipient = ({
  recipients = [],
  onChange,
  value,
  error,
}: RecipientProps) => {
  useEffect(() => {
    if (value) {
      const found = recipients.find((r) => r.address === value);
      setSelected(found || null);
    }
  }, [value, recipients]);

  const [selected, setSelected] = useState<Recipient | null>(null);

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
        onChange?.(found);
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
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      <WalletAddress address={selected?.address || ''} />
    </div>
  );
};

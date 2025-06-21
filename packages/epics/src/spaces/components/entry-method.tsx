'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Combobox } from '@hypha-platform/ui';

type EntryMethod = {
  name: string;
  value: number;
};

type EntryMethodProps = {
  entryMethods?: EntryMethod[];
  value?: number;
  onChange?: (selected: EntryMethod | { value: number }) => void;
};

export const EntryMethod = ({
  entryMethods = [],
  onChange,
  value,
}: EntryMethodProps) => {
  const [manualValue, setManualValue] = useState(value || 0);

  useEffect(() => {
    if (value !== undefined && value !== null) {
      setManualValue(value);
    }
  }, [value, entryMethods]);

  const placeholder = 'Select Entry Method...';

  const options = useMemo(
    () =>
      entryMethods.map((entryMethod) => ({
        label: String(entryMethod.name),
        value: String(entryMethod.value),
      })),
    [entryMethods],
  );

  const handleChange = useCallback(
    (value: string) => {
      const found = entryMethods.find((r) => String(r.value) === value) || null;

      if (found) {
        setManualValue(found.value);
        onChange?.(found);
      }
    },
    [entryMethods, onChange],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full justify-between items-center gap-2">
        <label className="text-sm text-neutral-11">Entry Method</label>

        <div className="flex items-center gap-2 min-w-[220px]">
          <Combobox
            options={options}
            placeholder={placeholder}
            onChange={handleChange}
            initialValue={String(manualValue)}
            renderOption={(option) => (
              <>
                {/* <Image
                  src={option.avatarUrl}
                  alt={option.label}
                  width={24}
                  height={24}
                  className="rounded-full"
                /> */}
                <span>{option.label}</span>
              </>
            )}
            renderValue={(option) =>
              option ? (
                <div className="flex items-center gap-2 truncate">
                  {/* <Image
                    src={option.avatarUrl}
                    alt={option.label}
                    width={24}
                    height={24}
                    className="rounded-full"
                  /> */}
                  <span className="truncate">{option.label}</span>
                </div>
              ) : (
                placeholder
              )
            }
          />
        </div>
      </div>
    </div>
  );
};

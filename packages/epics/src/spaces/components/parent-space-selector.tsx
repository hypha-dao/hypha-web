'use client';

import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { Combobox, Input, Image, Label } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import React from 'react';

type SpaceId = number | null | undefined;

export interface ParentSpaceSelectorProps {
  options?: {
    value: string;
    label: string;
  }[];
  isLoading: boolean;
  parentSpaceId?: SpaceId;
  setParentSpaceId?: (parentId: SpaceId) => void;
  className?: string;
}

export const ParentSpaceSelector = ({
  options,
  isLoading,
  parentSpaceId,
  setParentSpaceId,
  className,
}: ParentSpaceSelectorProps) => {
  const checkboxRef = React.useRef(null);
  const checkboxId = `checkbox-${crypto.randomUUID()}`;
  const [checked, setChecked] = React.useState(!parentSpaceId);
  const [dirty, setDirty] = React.useState(false);
  React.useEffect(() => {
    if (checked) {
      setParentSpaceId?.(null);
    } else {
      setParentSpaceId?.(-1);
    }
  }, [checked]);
  React.useEffect(() => {
    setChecked(!parentSpaceId);
  }, [parentSpaceId]);
  const parentSpaceIdString = React.useMemo(() => {
    return Number.isSafeInteger(parentSpaceId) ? `${parentSpaceId}` : '';
  }, [parentSpaceId]);
  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn('flex flex-row gap-1', className)}
        aria-disabled={isLoading}
      >
        <span className="flex flex-row">
          <div className="pt-1 pb-1 align-middle">
            <Label className="text-sm text-neutral-11">Linked to</Label>
          </div>
        </span>
        <span className="flex grow"></span>
        <span className="flex flex-row gap-1">
          <Combobox
            options={options ?? []}
            initialValue={parentSpaceIdString}
            disabled={checked || isLoading}
            onChange={(value: string) => {
              const parentId = Number.parseInt(value);
              setParentSpaceId?.(
                Number.isSafeInteger(parentId) ? parentId : null,
              );
            }}
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
                ''
              )
            }
            allowEmptyChoice={checked}
          />
          <div className="h-4 w-4">
            <Input
              id={checkboxId}
              ref={checkboxRef}
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                setChecked(e.target.checked);
                setDirty(true);
              }}
            />
          </div>
          <div className="pt-1 pb-1 align-middle">
            <Label htmlFor={checkboxId} className="text-sm text-neutral-11">
              Root Space
            </Label>
          </div>
        </span>
      </div>
      {dirty && checked && (
        <span className="text-1 text-neutral-11">
          <span>
            Marking this space as a Root Space will make it independent. It will
            no longer be linked to the current organisation, and all of its
            linked spaces will move with it.
          </span>
        </span>
      )}
    </div>
  );
};

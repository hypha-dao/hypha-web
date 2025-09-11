'use client';

import { Combobox, Input, Label } from '@hypha-platform/ui';
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
  React.useEffect(() => {
    if (checked) {
      setParentSpaceId?.(null);
    }
  }, [checked]);
  React.useEffect(() => {
    setChecked(!parentSpaceId);
  }, [parentSpaceId]);
  const parentSpaceIdString = React.useMemo(() => {
    return Number.isSafeInteger(parentSpaceId) ? `${parentSpaceId}` : '';
  }, [parentSpaceId]);
  return (
    <div
      className={cn('flex flex-row gap-1', className)}
      aria-disabled={isLoading}
    >
      <div className="pt-1 pb-1 align-middle">
        <Label className="text-sm text-neutral-11">Linked to</Label>
      </div>
      <div className="flex flex-col grow-0">
        <Combobox
          options={options ?? []}
          initialValue={parentSpaceIdString}
          className="border-0 md:w-40"
          disabled={checked || isLoading}
          onChange={(value: string) => {
            const parentId = Number.parseInt(value);
            setParentSpaceId?.(
              Number.isSafeInteger(parentId) ? parentId : null,
            );
          }}
          allowEmptyChoice={checked}
        />
      </div>
      <div className="flex grow"></div>
      <div className="h-4 w-4">
        <Input
          id={checkboxId}
          ref={checkboxRef}
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
      </div>
      <div className="pt-1 pb-1 align-middle">
        <Label htmlFor={checkboxId} className="text-sm text-neutral-11">
          Root Space
        </Label>
      </div>
    </div>
  );
};

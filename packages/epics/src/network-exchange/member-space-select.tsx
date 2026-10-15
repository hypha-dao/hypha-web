'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import type { MemberNamedSpace } from './use-member-named-spaces';

export function MemberSpaceSelect({
  spaces,
  value,
  onChange,
  label,
  emptyLabel,
  disabled,
}: {
  spaces: MemberNamedSpace[];
  value: string;
  onChange: (slug: string) => void;
  label: string;
  emptyLabel: string;
  disabled?: boolean;
}) {
  const isEmpty = spaces.length === 0;

  return (
    <Select
      value={value || undefined}
      onValueChange={onChange}
      disabled={disabled || isEmpty}
    >
      <SelectTrigger
        aria-label={label}
        className="h-11 w-full bg-neutral-2 font-semibold"
      >
        <SelectValue placeholder={isEmpty ? emptyLabel : label} />
      </SelectTrigger>
      <SelectContent>
        {spaces.map((space) => (
          <SelectItem key={space.slug} value={space.slug}>
            {space.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

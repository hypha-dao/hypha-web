'use client';

import { useState } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Image,
  Button,
} from '@hypha-platform/ui';

type Member = {
  name: string;
  surname: string;
  avatarUrl: string;
};

type Props = {
  members?: Member[];
  onChange?: (selected: Member) => void;
};

export default function AgreementFormRecipient({
  members = [],
  onChange,
}: Props) {
  const [selected, setSelected] = useState<Member | null>(null);

  const handleSelect = (member: Member) => {
    setSelected(member);
    onChange?.(member);
  };

  return (
    <div className="flex flex w-full justify-between">
      <label className="text-sm text-neutral-11">Recipient</label>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" colorVariant="neutral">
            {selected && (
              <Image
                src={selected.avatarUrl}
                alt={`${selected.name} ${selected.surname}`}
                width={24}
                height={24}
                className="rounded-full"
              />
            )}
            <span className="text-sm text-secondary-foreground">
              {selected
                ? `${selected.name} ${selected.surname}`
                : 'Select recipient...'}
            </span>
            <ChevronDownIcon className="w-4 h-4 ml-auto" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="bottom"
          align="start"
          className="min-w-[220px]"
        >
          {members?.map((member, index) => (
            <DropdownMenuItem
              key={index}
              onSelect={() => handleSelect(member)}
              className="flex items-center gap-2 px-2 py-1.5"
            >
              <Image
                src={member.avatarUrl}
                alt={`${member.name} ${member.surname}`}
                width={24}
                height={24}
                className="rounded-full"
              />
              <span>{`${member.name} ${member.surname}`}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

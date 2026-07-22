'use client';

import React from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { Person } from '@hypha-platform/core/client';
import {
  Button,
  Image,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { personRosterDisplayLabel } from '../../common/human-chat-panel/build-space-roster-mention-candidates';

type MemberOption = {
  value: string;
  label: string;
  searchText: string;
  avatarUrl?: string | null;
};

function toMemberOptions(
  members: Person[],
  unknownLabel: string,
): MemberOption[] {
  return members.map((person) => {
    const label = personRosterDisplayLabel(person, unknownLabel);
    return {
      value: String(person.id),
      label,
      searchText: [label, person.nickname, person.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      avatarUrl: person.avatarUrl,
    };
  });
}

function MemberAvatar({
  label,
  avatarUrl,
}: {
  label: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={label}
        width={24}
        height={24}
        className="size-6 min-h-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-4 text-1 font-medium text-neutral-11"
    >
      {label.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

type SpaceMemberSelectBaseProps = {
  members: Person[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyListMessage?: string;
  unknownLabel?: string;
  disabled?: boolean;
  className?: string;
};

type SpaceMemberSingleSelectProps = SpaceMemberSelectBaseProps & {
  mode?: 'single';
  value: string | null;
  onChange: (value: string | null) => void;
  unassignedLabel?: string;
  allowUnassigned?: boolean;
};

type SpaceMemberMultiSelectProps = SpaceMemberSelectBaseProps & {
  mode: 'multi';
  value: string[];
  onChange: (value: string[]) => void;
};

export type SpaceMemberSelectProps =
  | SpaceMemberSingleSelectProps
  | SpaceMemberMultiSelectProps;

export function SpaceMemberSelect(props: SpaceMemberSelectProps) {
  const {
    members,
    placeholder = 'Select…',
    searchPlaceholder = 'Search members…',
    emptyListMessage = 'No members found.',
    unknownLabel = 'Unknown member',
    disabled = false,
    className,
  } = props;

  const isMulti = props.mode === 'multi';
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const options = React.useMemo(
    () => toMemberOptions(members, unknownLabel),
    [members, unknownLabel],
  );

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((option) => option.searchText.includes(term));
  }, [options, searchTerm]);

  const selectedIds = isMulti ? props.value : props.value ? [props.value] : [];

  const selectedOptions = options.filter((option) =>
    selectedIds.includes(option.value),
  );

  const unassignedLabel =
    !isMulti && props.allowUnassigned !== false
      ? props.unassignedLabel ?? 'Unassigned'
      : null;

  const selectSingle = (id: string | null) => {
    if (disabled || isMulti) return;
    props.onChange(id);
    setOpen(false);
    setSearchTerm('');
  };

  const toggleMulti = (id: string) => {
    if (disabled || !isMulti) return;
    const next = props.value.includes(id)
      ? props.value.filter((value) => value !== id)
      : [...props.value, id];
    props.onChange(next);
  };

  return (
    <Popover
      modal={false}
      open={open && !disabled}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (!next) setSearchTerm('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          colorVariant="neutral"
          role="combobox"
          aria-expanded={open && !disabled}
          disabled={disabled}
          className={cn(
            'h-auto min-h-10 w-full justify-between py-2 font-normal',
            disabled && 'pointer-events-none opacity-50',
            className,
          )}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {isMulti ? (
              selectedOptions.length > 0 ? (
                selectedOptions.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-neutral-3 px-1.5 py-0.5 text-1 text-neutral-12"
                  >
                    <MemberAvatar
                      label={option.label}
                      avatarUrl={option.avatarUrl}
                    />
                    <span className="truncate">{option.label}</span>
                    <span
                      role="button"
                      tabIndex={-1}
                      className="rounded-full p-0.5 hover:bg-neutral-5"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        props.onChange(
                          props.value.filter((id) => id !== option.value),
                        );
                      }}
                    >
                      <X className="size-3" />
                    </span>
                  </span>
                ))
              ) : (
                <span className="text-neutral-11">{placeholder}</span>
              )
            ) : selectedOptions[0] ? (
              <div className="flex min-w-0 items-center gap-2">
                <MemberAvatar
                  label={selectedOptions[0].label}
                  avatarUrl={selectedOptions[0].avatarUrl}
                />
                <span className="truncate">{selectedOptions[0].label}</span>
              </div>
            ) : (
              <span className="text-neutral-11">
                {unassignedLabel ?? placeholder}
              </span>
            )}
          </div>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b border-neutral-5 px-3 py-2">
          <Search className="size-4 shrink-0 text-neutral-10" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            disabled={disabled}
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {!isMulti && unassignedLabel ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-2 hover:bg-accent-3"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSingle(null)}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-4 text-1 text-neutral-11">
                —
              </span>
              <span className="flex-1 truncate">{unassignedLabel}</span>
              <Check
                className={cn(
                  'ml-auto size-4',
                  !props.value ? 'opacity-100' : 'opacity-0',
                )}
              />
            </button>
          ) : null}

          {filteredOptions.length === 0 ? (
            <p className="px-2 py-3 text-2 text-neutral-11">
              {emptyListMessage}
            </p>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = selectedIds.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-2 hover:bg-accent-3',
                    isSelected && 'bg-accent-3/60',
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    isMulti
                      ? toggleMulti(option.value)
                      : selectSingle(option.value)
                  }
                >
                  {isMulti ? (
                    <div
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible',
                      )}
                    >
                      <Check className="size-3" />
                    </div>
                  ) : null}
                  <MemberAvatar
                    label={option.label}
                    avatarUrl={option.avatarUrl}
                  />
                  <span className="flex-1 truncate">{option.label}</span>
                  {!isMulti ? (
                    <Check
                      className={cn(
                        'ml-auto size-4',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

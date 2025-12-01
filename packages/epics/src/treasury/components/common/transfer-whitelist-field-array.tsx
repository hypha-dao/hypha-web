'use client';

import { useMemo } from 'react';
import {
  Button,
  Combobox,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Switch,
} from '@hypha-platform/ui';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Person, Space } from '@hypha-platform/core/client';

type WhitelistType = 'member' | 'space';

type TransferWhitelistFieldArrayProps = {
  name: string;
  label: string;
  description?: string;
  members?: Person[];
  spaces?: Space[];
};

const DEFAULT_WHITELIST_ENTRY = {
  type: 'member' as WhitelistType,
  address: '',
  includeSpaceMembers: true,
};

export const TransferWhitelistFieldArray = ({
  name,
  label,
  description,
  members = [],
  spaces = [],
}: TransferWhitelistFieldArrayProps) => {
  const { control, setValue, watch } = useFormContext();

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        value: member.address ?? '',
        label: `${member.name} ${member.surname}`,
        searchText: `${member.name} ${member.surname}`.toLowerCase(),
        avatarUrl: member.avatarUrl,
      })),
    [members],
  );

  const spaceOptions = useMemo(
    () =>
      spaces.map((space) => ({
        value: space.address ?? space.slug ?? '',
        label: space.title,
        searchText: space.title.toLowerCase(),
        avatarUrl: space.logoUrl,
      })),
    [spaces],
  );

  const entries = watch(name) ?? [];

  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const handleAddField = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    append({ ...DEFAULT_WHITELIST_ENTRY });
  };

  const handleRemoveField = (
    event: React.MouseEvent<HTMLButtonElement>,
    index: number,
  ) => {
    event.preventDefault();
    if (fields.length === 1) {
      setValue(`${name}.${index}`, { ...DEFAULT_WHITELIST_ENTRY });
      return;
    }
    remove(index);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <FormLabel>{label}</FormLabel>
        {description ? (
          <span className="text-2 text-neutral-11">{description}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        {fields.map((field, index) => {
          const currentEntry = entries?.[index];
          const currentType = (currentEntry?.type ?? 'member') as WhitelistType;
          const comboboxOptions =
            currentType === 'member'
              ? memberOptions
              : spaceOptions.length
              ? spaceOptions
              : memberOptions;
          const placeholder =
            currentType === 'member' ? 'Select member...' : 'Select space...';

          return (
            <div
              key={field.id}
              className="flex flex-col gap-4 rounded-xl border border-neutral-6 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-2 text-neutral-11">
                    Member or Space
                  </span>
                  <span className="text-1 text-neutral-10">
                    Choose whether this entry targets an individual member or an
                    entire space.
                  </span>
                </div>
                <FormField
                  control={control}
                  name={`${name}.${index}.type`}
                  render={({ field }) => (
                    <Tabs
                      value={(field.value as WhitelistType) ?? 'member'}
                      onValueChange={(value) => {
                        field.onChange(value as WhitelistType);
                        setValue(`${name}.${index}.address`, '');
                      }}
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
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-2 text-neutral-11">
                  {currentType === 'member'
                    ? 'Select a member'
                    : 'Select a space'}
                </span>
                <Combobox
                  key={`${name}.${index}.combobox-${currentType}-${
                    currentEntry?.address ?? 'empty'
                  }`}
                  options={comboboxOptions}
                  placeholder={placeholder}
                  initialValue={currentEntry?.address ?? ''}
                  onChange={(value) =>
                    setValue(`${name}.${index}.address`, value)
                  }
                  emptyListMessage={
                    currentType === 'member'
                      ? 'No members match your search.'
                      : 'No spaces match your search.'
                  }
                />
              </div>

              <FormField
                control={control}
                name={`${name}.${index}.address`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <span className="text-2 text-neutral-11">
                      Blockchain Address
                    </span>
                    <Input
                      placeholder="0x..."
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              {currentType === 'space' && (
                <FormField
                  control={control}
                  name={`${name}.${index}.includeSpaceMembers`}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-col gap-1">
                          <span className="text-2 text-neutral-11">
                            Space Access Scope
                          </span>
                          <span className="text-1 text-neutral-10">
                            Toggle whether transfers should include the entire
                            space membership or only the space account.
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-2 text-neutral-11">
                            {field.value === false
                              ? 'Space only'
                              : 'Space & Members'}
                          </span>
                          <Switch
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                          />
                        </div>
                      </div>
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  onClick={(event) => handleRemoveField(event, index)}
                  className="gap-2 text-2"
                >
                  <Cross2Icon />
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-start md:justify-end">
        <Button
          variant="ghost"
          onClick={handleAddField}
          className="gap-2 text-2"
        >
          <PlusIcon />
          Add
        </Button>
      </div>
    </div>
  );
};

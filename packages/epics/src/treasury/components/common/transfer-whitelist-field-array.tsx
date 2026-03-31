'use client';

import { useMemo } from 'react';
import {
  Button,
  Combobox,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Image,
  Input,
  Switch,
} from '@hypha-platform/ui';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { useFieldArray, useFormContext } from 'react-hook-form';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  Person,
  Space,
} from '@hypha-platform/core/client';
import { useFilterSpacesListWithDiscoverability } from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';

type WhitelistType = 'member' | 'space';

type TransferWhitelistFieldArrayProps = {
  name: string;
  label: string;
  description?: string;
  members?: Person[];
  spaces?: Space[];
};

const DEFAULT_WHITELIST_ENTRY = {
  type: 'space' as WhitelistType,
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
  const tAgreementFlow = useTranslations('AgreementFlow');

  const { filteredSpaces } = useFilterSpacesListWithDiscoverability({
    spaces,
    useGeneralState: true,
  });

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
      filteredSpaces.map((space) => ({
        value: space.address ?? space.slug ?? '',
        label: space.title,
        searchText: space.title.toLowerCase(),
        avatarUrl: space.logoUrl,
      })),
    [filteredSpaces],
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
          const currentType = (currentEntry?.type ?? 'space') as WhitelistType;
          const comboboxOptions =
            currentType === 'member' ? memberOptions : spaceOptions;
          const placeholder =
            currentType === 'member'
              ? tAgreementFlow(
                  'plugins.issueNewToken.transfer.whitelist.selectMemberPlaceholder',
                )
              : tAgreementFlow(
                  'plugins.issueNewToken.transfer.whitelist.selectSpacePlaceholder',
                );

          return (
            <div
              key={field.id}
              className="flex flex-col gap-4 rounded-xl border border-neutral-6 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-2 text-neutral-11">
                    {tAgreementFlow(
                      'plugins.issueNewToken.transfer.whitelist.memberOrSpace',
                    )}
                  </span>
                  <span className="text-1 text-neutral-10">
                    {tAgreementFlow(
                      'plugins.issueNewToken.transfer.whitelist.memberOrSpaceDescription',
                    )}
                  </span>
                </div>
                <FormField
                  control={control}
                  name={`${name}.${index}.type`}
                  render={({ field }) => (
                    <Tabs
                      value={(field.value as WhitelistType) ?? 'space'}
                      onValueChange={(value) => {
                        field.onChange(value as WhitelistType);
                        setValue(`${name}.${index}.address`, '');
                      }}
                    >
                      <TabsList triggerVariant="switch">
                        <TabsTrigger variant="switch" value="member">
                          {tAgreementFlow(
                            'plugins.issueNewToken.transfer.whitelist.member',
                          )}
                        </TabsTrigger>
                        <TabsTrigger variant="switch" value="space">
                          {tAgreementFlow(
                            'plugins.issueNewToken.transfer.whitelist.space',
                          )}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-2 text-neutral-11">
                  {currentType === 'member'
                    ? tAgreementFlow(
                        'plugins.issueNewToken.transfer.whitelist.selectMember',
                      )
                    : tAgreementFlow(
                        'plugins.issueNewToken.transfer.whitelist.selectSpace',
                      )}
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
                      ? tAgreementFlow(
                          'plugins.issueNewToken.transfer.whitelist.noMembersFound',
                        )
                      : tAgreementFlow(
                          'plugins.issueNewToken.transfer.whitelist.noSpacesFound',
                        )
                  }
                  renderOption={(option) => (
                    <>
                      <Image
                        src={
                          option.avatarUrl ||
                          (currentType === 'member'
                            ? '/placeholder/default-profile.svg'
                            : DEFAULT_SPACE_AVATAR_IMAGE)
                        }
                        alt={option.label}
                        width={24}
                        height={24}
                        className="rounded-full min-h-5 min-w-5"
                      />
                      <span className="text-ellipsis overflow-hidden text-nowrap">
                        {option.label}
                      </span>
                    </>
                  )}
                  renderValue={(option) =>
                    option ? (
                      <div className="flex items-center gap-2 truncate">
                        <Image
                          src={
                            option.avatarUrl ||
                            (currentType === 'member'
                              ? '/placeholder/default-profile.svg'
                              : DEFAULT_SPACE_AVATAR_IMAGE)
                          }
                          alt={option.label}
                          width={24}
                          height={24}
                          className="rounded-full min-h-5 min-w-5"
                        />
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

              <FormField
                control={control}
                name={`${name}.${index}.address`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <span className="text-2 text-neutral-11">
                      {tAgreementFlow(
                        'plugins.issueNewToken.transfer.whitelist.blockchainAddress',
                      )}
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
                            {tAgreementFlow(
                              'plugins.issueNewToken.transfer.whitelist.spaceAccessScope',
                            )}
                          </span>
                          <span className="text-1 text-neutral-10">
                            {tAgreementFlow(
                              'plugins.issueNewToken.transfer.whitelist.spaceAccessScopeDescription',
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-2 text-neutral-11">
                            {field.value === false
                              ? tAgreementFlow(
                                  'plugins.issueNewToken.transfer.whitelist.spaceOnly',
                                )
                              : tAgreementFlow(
                                  'plugins.issueNewToken.transfer.whitelist.spaceAndMembers',
                                )}
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
                  {tAgreementFlow(
                    'plugins.issueNewToken.transfer.whitelist.remove',
                  )}
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
          {tAgreementFlow('plugins.issueNewToken.transfer.whitelist.add')}
        </Button>
      </div>
    </div>
  );
};

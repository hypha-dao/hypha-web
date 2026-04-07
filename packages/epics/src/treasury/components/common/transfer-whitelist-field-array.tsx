'use client';

import { useEffect, useMemo } from 'react';
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
  transferWhitelistEntryDedupeKey,
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
  const { control, setValue, watch, trigger } = useFormContext();
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

  const usedKeysByOtherRows = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];
    return list.map((_entry, selfIdx) => {
      const keys = new Set<string>();
      for (let j = 0; j < list.length; j++) {
        if (j === selfIdx) continue;
        const e = list[j] as {
          type?: WhitelistType;
          address?: string;
        };
        const t = e?.type === 'space' ? 'space' : 'member';
        const k = e?.address
          ? transferWhitelistEntryDedupeKey(t, e.address)
          : undefined;
        if (k) keys.add(k);
      }
      return keys;
    });
  }, [entries]);

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name,
  });

  /**
   * External hydration (e.g. update-token baseline via setValue) updates form values but
   * does not always sync useFieldArray's internal `fields` — rows stay empty until append.
   * We only replace when lengths differ so user edits (same length) do not reset rows per keystroke.
   */
  const listForSync = Array.isArray(entries) ? entries : [];

  useEffect(() => {
    if (fields.length === listForSync.length) {
      return;
    }
    replace(listForSync);
  }, [fields.length, listForSync, replace]);

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
          const taken = usedKeysByOtherRows[index] ?? new Set<string>();
          const currentRowKey = currentEntry?.address
            ? transferWhitelistEntryDedupeKey(currentType, currentEntry.address)
            : undefined;
          const baseOptions =
            currentType === 'member' ? memberOptions : spaceOptions;
          /** Hide options picked on *other* rows, but always keep this row's value so the combobox is not blank (e.g. duplicate hydration). */
          const comboboxOptions = baseOptions.filter((opt) => {
            const k = transferWhitelistEntryDedupeKey(currentType, opt.value);
            if (!k) return true;
            if (currentRowKey && k === currentRowKey) return true;
            return !taken.has(k);
          });
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
                        void trigger(`${name}.${index}.address`);
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
                  onChange={(value) => {
                    setValue(`${name}.${index}.address`, value, {
                      shouldValidate: true,
                    });
                  }}
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
                      onChange={(e) => {
                        field.onChange(e);
                        void trigger(`${name}.${index}.address`);
                      }}
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

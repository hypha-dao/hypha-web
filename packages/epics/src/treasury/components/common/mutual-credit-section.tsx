'use client';

import { useMemo, useCallback } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  Badge,
  Button,
  Combobox,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Image,
  Input,
  Switch,
} from '@hypha-platform/ui';
import { Cross2Icon } from '@radix-ui/react-icons';
import { DEFAULT_SPACE_AVATAR_IMAGE, Space } from '@hypha-platform/core/client';
import { cn, handleNumberChange } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

type MutualCreditSectionProps = {
  enableMutualCredit: boolean;
  setEnableMutualCredit: (value: boolean) => void;
  /** Spaces available for picking; current/issuing space is always auto-included. */
  spaces: Space[];
  /** Web3 id of the current/issuing space — auto-included and not removable. */
  currentSpaceWeb3Id?: number | null;
};

export const MutualCreditSection = ({
  enableMutualCredit,
  setEnableMutualCredit,
  spaces,
  currentSpaceWeb3Id,
}: MutualCreditSectionProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { control, setValue, getValues } = useFormContext();

  const selectedIds = (useWatch({
    control,
    name: 'creditWhitelistedSpaceIds',
  }) ?? []) as number[];

  const defaultCreditLimit = useWatch({
    control,
    name: 'defaultCreditLimit',
    defaultValue: 0,
  });

  /** Map web3SpaceId → space for label/icon resolution */
  const spaceById = useMemo(() => {
    const m = new Map<number, Space>();
    for (const s of spaces) {
      if (typeof s.web3SpaceId === 'number') {
        m.set(s.web3SpaceId, s);
      }
    }
    return m;
  }, [spaces]);

  const handleAddSpace = useCallback(
    (rawValue: string) => {
      const id = Number(rawValue);
      if (!Number.isFinite(id) || id <= 0) return;
      if (id === currentSpaceWeb3Id) return;
      const current = (getValues('creditWhitelistedSpaceIds') ??
        []) as number[];
      if (current.includes(id)) return;
      setValue('creditWhitelistedSpaceIds', [...current, id], {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [getValues, setValue, currentSpaceWeb3Id],
  );

  const handleRemoveSpace = useCallback(
    (id: number) => {
      const current = (getValues('creditWhitelistedSpaceIds') ??
        []) as number[];
      setValue(
        'creditWhitelistedSpaceIds',
        current.filter((v) => v !== id),
        { shouldDirty: true, shouldValidate: true },
      );
    },
    [getValues, setValue],
  );

  const handleCreditLimitChange = handleNumberChange(
    setValue,
    'defaultCreditLimit',
  );

  const comboboxOptions = useMemo(() => {
    return spaces
      .filter(
        (s) =>
          typeof s.web3SpaceId === 'number' &&
          s.web3SpaceId !== currentSpaceWeb3Id &&
          !selectedIds.includes(s.web3SpaceId),
      )
      .map((s) => ({
        value: String(s.web3SpaceId),
        label: s.title,
        searchText: s.title.toLowerCase(),
        avatarUrl: s.logoUrl,
      }));
  }, [spaces, selectedIds, currentSpaceWeb3Id]);

  const selectedSpaces = useMemo(() => {
    return selectedIds
      .map((id) => spaceById.get(id))
      .filter((s): s is Space => Boolean(s));
  }, [selectedIds, spaceById]);

  const currentSpace =
    typeof currentSpaceWeb3Id === 'number'
      ? spaceById.get(currentSpaceWeb3Id)
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>
        {tAgreementFlow('plugins.issueNewToken.mutualCredit.title')}
      </FormLabel>
      <span className="text-2 text-neutral-11">
        {tAgreementFlow('plugins.issueNewToken.mutualCredit.description')}
      </span>
      <div className="flex w-full justify-between items-center text-2 text-neutral-11">
        <span>
          {tAgreementFlow('plugins.issueNewToken.mutualCredit.enable')}
        </span>
        <Switch
          checked={enableMutualCredit}
          onCheckedChange={setEnableMutualCredit}
          className="ml-2"
        />
      </div>
      {enableMutualCredit && (
        <>
          <FormField
            control={control}
            name="defaultCreditLimit"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center gap-2">
                  <FormLabel className="text-2 text-neutral-11 whitespace-nowrap md:pt-1">
                    {tAgreementFlow(
                      'plugins.issueNewToken.mutualCredit.creditLimitLabel',
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder={tAgreementFlow(
                        'plugins.issueNewToken.mutualCredit.creditLimitPlaceholder',
                      )}
                      value={defaultCreditLimit ?? 0}
                      onChange={handleCreditLimitChange}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-col gap-2">
            <FormLabel className="text-2 text-neutral-11">
              {tAgreementFlow(
                'plugins.issueNewToken.mutualCredit.eligibleSpacesLabel',
              )}
            </FormLabel>
            <span className="text-1 text-neutral-10">
              {tAgreementFlow(
                'plugins.issueNewToken.mutualCredit.eligibleSpacesDescription',
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              {currentSpace ? (
                <Badge variant="outline" className="gap-1.5 py-1 pl-1 pr-2">
                  <Image
                    src={currentSpace.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
                    alt={currentSpace.title}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                  <span className="text-1">
                    {currentSpace.title}
                    <span className="ml-1 text-neutral-10">
                      ·{' '}
                      {tAgreementFlow(
                        'plugins.issueNewToken.mutualCredit.currentSpaceTag',
                      )}
                    </span>
                  </span>
                </Badge>
              ) : null}
              {selectedSpaces.map((s) => (
                <Badge
                  key={s.web3SpaceId}
                  variant="outline"
                  className="gap-1.5 py-1 pl-1 pr-1"
                >
                  <Image
                    src={s.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
                    alt={s.title}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                  <span className="text-1">{s.title}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn('h-4 w-4 rounded-full p-0')}
                    onClick={() =>
                      typeof s.web3SpaceId === 'number' &&
                      handleRemoveSpace(s.web3SpaceId)
                    }
                    aria-label={tAgreementFlow(
                      'plugins.issueNewToken.mutualCredit.removeSpace',
                    )}
                  >
                    <Cross2Icon />
                  </Button>
                </Badge>
              ))}
            </div>
            {comboboxOptions.length > 0 ? (
              <Combobox
                key={`mutual-credit-space-picker-${selectedIds.length}`}
                options={comboboxOptions}
                placeholder={tAgreementFlow(
                  'plugins.issueNewToken.mutualCredit.addSpacePlaceholder',
                )}
                initialValue=""
                onChange={(value) => {
                  if (value) handleAddSpace(value);
                }}
                emptyListMessage={tAgreementFlow(
                  'plugins.issueNewToken.transfer.whitelist.noSpacesFound',
                )}
                renderOption={(option) => (
                  <>
                    <Image
                      src={option.avatarUrl || DEFAULT_SPACE_AVATAR_IMAGE}
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
                renderValue={() =>
                  tAgreementFlow(
                    'plugins.issueNewToken.mutualCredit.addSpacePlaceholder',
                  )
                }
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

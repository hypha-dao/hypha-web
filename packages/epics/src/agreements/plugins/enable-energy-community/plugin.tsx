'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import type { Person, Space } from '@hypha-platform/core/client';
import {
  Cross2Icon,
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons';
import { useFieldArray, useFormContext } from 'react-hook-form';
import {
  EnergyOptimizationFields,
  EnergySocialAllocationFields,
  PercentageSplitFieldArray,
} from './energy-form-fields';
import { RecipientField } from '../components/common/recipient-field';

type EnableEnergyCommunityPluginProps = {
  members?: Person[];
  spaces?: Space[];
};

const SOURCE_TYPE_VALUES = ['SOLAR', 'BATTERY'] as const;

/** Fixed settlement price (human units); matches form default / deploy mapping. */
export const DEFAULT_BASE_PRICE_PER_KWH = '0.1';

const emptySource = {
  name: '',
  sourceType: 'SOLAR',
  basePricePerKwh: DEFAULT_BASE_PRICE_PER_KWH,
  owners: [],
  tokenName: '',
  tokenSymbol: '',
};

export const EnableEnergyCommunityPlugin = ({
  members = [],
  spaces = [],
}: EnableEnergyCommunityPluginProps) => {
  const t = useTranslations('Energy.plugins.enableCommunity');
  const tShared = useTranslations('Energy.shared');
  const { control } = useFormContext();
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const {
    fields: sourceFields,
    append: appendSource,
    remove: removeSource,
  } = useFieldArray({
    control,
    name: 'energyCommunityActivation.sources',
  });
  const {
    fields: memberFields,
    append: appendMember,
    remove: removeMember,
  } = useFieldArray({
    control,
    name: 'energyCommunityActivation.members',
  });

  React.useEffect(() => {
    if (sourceFields.length === 0) {
      appendSource({ ...emptySource });
    }
  }, [appendSource, sourceFields.length]);

  return (
    <div className="flex flex-col gap-4">
      <EnergyOptimizationFields />

      {/* Section — Members */}
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-1">
          <div className="text-1 font-medium">{t('membersTitle')}</div>
          <p className="text-2 text-secondary-foreground">
            {t('membersDescription')}
          </p>
        </div>
        {memberFields.map((field, index) => (
          <div
            key={field.id}
            className="flex flex-col gap-3 rounded-md border border-border p-3"
          >
            <RecipientField
              name={`energyCommunityActivation.members.${index}.recipient`}
              members={members}
              spaces={spaces}
              defaultRecipientType="member"
            />
            <div className="flex items-end justify-between gap-2">
              <FormField
                control={control}
                name={`energyCommunityActivation.members.${index}.meterCount`}
                render={({ field: meterField }) => (
                  <FormItem>
                    <FormLabel className="text-2 text-neutral-11">
                      {t('numberOfMeters')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        className="w-28"
                        placeholder={t('meterPlaceholder')}
                        value={meterField.value ?? ''}
                        onChange={meterField.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeMember(index)}
              >
                <Cross2Icon />
                {tShared('remove')}
              </Button>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => appendMember({ recipient: '', meterCount: '0' })}
          >
            <PlusIcon />
            {t('addMember')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-1">
          <div className="text-1 font-medium">{t('sourcesTitle')}</div>
          <p className="text-2 text-secondary-foreground">
            {t('sourcesDescription')}
          </p>
        </div>
        {sourceFields.map((sourceField, index) => (
          <div
            key={sourceField.id}
            className="flex flex-col gap-3 rounded-md border border-border p-3"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField
                control={control}
                name={`energyCommunityActivation.sources.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('name')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('namePlaceholder')}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`energyCommunityActivation.sources.${index}.sourceType`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('type')}</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectType')} />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_TYPE_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value === 'SOLAR'
                                ? t('sourceTypeSolar')
                                : t('sourceTypeBattery')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <FormLabel>{t('ownership')}</FormLabel>
              <PercentageSplitFieldArray
                name={`energyCommunityActivation.sources.${index}.owners`}
                members={members}
                spaces={spaces}
                addLabel={t('addOwner')}
              />
              <FormField
                control={control}
                name={`energyCommunityActivation.sources.${index}.owners`}
                render={() => (
                  <FormItem>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showAdvanced && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormField
                  control={control}
                  name={`energyCommunityActivation.sources.${index}.tokenName`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tokenNameOptional')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('tokenNamePlaceholder')}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`energyCommunityActivation.sources.${index}.tokenSymbol`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tokenSymbolOptional')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('tokenSymbolPlaceholder')}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeSource(index)}
                disabled={sourceFields.length <= 1}
              >
                <Cross2Icon />
                {t('removeSource')}
              </Button>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => appendSource({ ...emptySource })}
          >
            <PlusIcon />
            {t('addSource')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <Button
          type="button"
          variant="ghost"
          className="self-start px-0"
          onClick={() => setShowAdvanced((prev) => !prev)}
        >
          {showAdvanced ? <ChevronDownIcon /> : <ChevronRightIcon />}
          {t('advancedSettings')}
        </Button>

        {showAdvanced && (
          <div className="flex flex-col gap-4">
            <EnergySocialAllocationFields members={members} spaces={spaces} />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField
                control={control}
                name="energyCommunityActivation.admin"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{t('adminAddress')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0x..."
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        readOnly
                      />
                    </FormControl>
                    <p className="text-2 text-secondary-foreground">
                      {t('adminHint')}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="energyCommunityActivation.stablecoin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('stablecoinAddress')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('stablecoinPlaceholder')}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="energyCommunityActivation.gridOperator"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('gridOperatorAddress')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('gridOperatorPlaceholder')}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="energyCommunityActivation.communityAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('communityFeeAddress')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('communityFeePlaceholder')}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="energyCommunityActivation.communityFeePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('communityFee')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('communityFeePercentPlaceholder')}
                        rightIcon={<>%</>}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="energyCommunityActivation.aggregatorAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('aggregatorFeeAddress')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('aggregatorFeePlaceholder')}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="energyCommunityActivation.aggregatorFeePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('aggregatorFee')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('aggregatorFeePercentPlaceholder')}
                        rightIcon={<>%</>}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="energyCommunityActivation.exportDeviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('exportDeviceId')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder={t('exportDeviceIdPlaceholder')}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="energyCommunityActivation.energyTokenName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('energyTokenName')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('energyTokenNamePlaceholder')}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="energyCommunityActivation.energyTokenSymbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('energyTokenSymbol')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('energyTokenSymbolPlaceholder')}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

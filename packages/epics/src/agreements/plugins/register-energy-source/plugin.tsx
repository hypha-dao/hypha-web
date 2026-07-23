'use client';

import React from 'react';
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
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { PercentageSplitFieldArray } from '../enable-energy-community/energy-form-fields';

const SOURCE_TYPE_VALUES = ['SOLAR', 'BATTERY'] as const;

type RegisterEnergySourcePluginProps = {
  members?: Person[];
  spaces?: Space[];
};

/**
 * Register Energy Source fields, mirroring the "Energy sources" section of
 * the Enable Energy Community form: name, type, ownership split, and
 * optional token overrides behind Advanced settings.
 */
export const RegisterEnergySourcePlugin = ({
  members = [],
  spaces = [],
}: RegisterEnergySourcePluginProps) => {
  const t = useTranslations('Energy.plugins.enableCommunity');
  const tSource = useTranslations('Energy.plugins.registerSource');
  const { control } = useFormContext();
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-1">
        <div className="text-1 font-medium">{t('sourcesTitle')}</div>
        <p className="text-2 text-secondary-foreground">
          {tSource('sectionDescription')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FormField
          control={control}
          name="energySource.name"
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
          name="energySource.sourceType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('type')}</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
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
          name="energySource.owners"
          members={members}
          spaces={spaces}
          addLabel={t('addOwner')}
        />
        <FormField
          control={control}
          name="energySource.owners"
          render={() => (
            <FormItem>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField
            control={control}
            name="energySource.tokenName"
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
            name="energySource.tokenSymbol"
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
    </div>
  );
};

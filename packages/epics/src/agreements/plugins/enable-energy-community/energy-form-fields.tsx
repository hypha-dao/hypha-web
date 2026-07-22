'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';
import clsx from 'clsx';
import {
  Button,
  Card,
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
  Switch,
} from '@hypha-platform/ui';
import {
  ENERGY_BASE_PURPOSES,
  percentageStringToBigInt,
  type EnergyBasePurpose,
  type EnergyPurposeRanking,
  type EnergySocialMode,
  type Person,
  type Space,
} from '@hypha-platform/core/client';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { Coins, Leaf, Zap } from 'lucide-react';
import { RecipientField } from '../components/common/recipient-field';
import { ConversionPercentageInput } from '../components/common/token-percentage-field';

type EnergyTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

// ─────────────────────────────────────────────────────────────────────────
//  Option metadata (REC memo Level 1 + Level 2)
// ─────────────────────────────────────────────────────────────────────────

export const getBasePurposeOptions = (t: EnergyTranslate) =>
  [
    {
      value: 'SELF_CONSUMPTION' as const,
      label: t('optimization.selfConsumption'),
      description: t('optimization.selfConsumptionDescription'),
      icon: <Zap className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />,
    },
    {
      value: 'MIN_CO2' as const,
      label: t('optimization.minCo2'),
      description: t('optimization.minCo2Description'),
      icon: <Leaf className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />,
    },
    {
      value: 'LOWEST_PRICE' as const,
      label: t('optimization.lowestPrice'),
      description: t('optimization.lowestPriceDescription'),
      icon: (
        <Coins className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
      ),
    },
  ] as const;

export const getSocialModeOptions = (t: EnergyTranslate) =>
  [
    {
      value: 'VARIABLE' as const,
      label: t('optimization.variableMode'),
      description: t('optimization.variableModeDescription'),
    },
    {
      value: 'FIXED' as const,
      label: t('optimization.fixedMode'),
      description: t('optimization.fixedModeDescription'),
    },
  ] as const;

export const basePurposeLabel = (value: string, t: EnergyTranslate): string => {
  const option = getBasePurposeOptions(t).find(
    (entry) => entry.value === value,
  );
  return option?.label ?? value;
};

/**
 * The contract stores a full 3-objective ranking, but the UI only asks for the
 * single primary objective. Fill priorities 2 and 3 with the remaining
 * objectives (in their canonical order) so the on-chain ranking stays a valid
 * distinct permutation.
 */
export const completeRanking = (
  primary: EnergyBasePurpose,
): EnergyPurposeRanking => {
  const rest = ENERGY_BASE_PURPOSES.filter((purpose) => purpose !== primary);
  return [primary, rest[0]!, rest[1]!];
};

// ─────────────────────────────────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────────────────────────────────

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const createPercentageStringSchema = (t: EnergyTranslate) =>
  z
    .string()
    .trim()
    .refine((value) => {
      try {
        percentageStringToBigInt(value);
        return true;
      } catch {
        return false;
      }
    }, t('validation.percentageRange'));

export const createEnergyOptimizationSchema = (t: EnergyTranslate) => {
  const percentageString = createPercentageStringSchema(t);
  const memberPercentRow = z.object({
    recipient: z
      .string()
      .trim()
      .regex(ADDRESS_RE, t('validation.selectMemberOrSpace')),
    percentage: percentageString,
  });
  const purposeEnum = z.enum(ENERGY_BASE_PURPOSES);

  return z
    .object({
      purpose1: purposeEnum,
      purpose2: purposeEnum,
      purpose3: purposeEnum,
      socialEnabled: z.boolean().optional(),
      socialMode: z.enum(['FIXED', 'VARIABLE']).optional(),
      socialFixedKwh: z.string().trim().optional(),
      socialVariablePercent: z.string().trim().optional(),
      socialWallets: z.array(memberPercentRow).optional(),
    })
    .superRefine((value, ctx) => {
      if (
        new Set([value.purpose1, value.purpose2, value.purpose3]).size !== 3
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['purpose3'],
          message: t('validation.distinctPriorities'),
        });
      }

      if (!value.socialEnabled) return;

      if (!value.socialMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['socialMode'],
          message: t('validation.selectSocialMode'),
        });
      }

      if (value.socialMode === 'FIXED') {
        if (!value.socialFixedKwh || !/^\d+$/.test(value.socialFixedKwh)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['socialFixedKwh'],
            message: t('validation.wholeKwhPerInterval'),
          });
        }
      }

      if (value.socialMode === 'VARIABLE') {
        let ok = false;
        try {
          percentageStringToBigInt(value.socialVariablePercent ?? '');
          ok = true;
        } catch {
          ok = false;
        }
        if (!ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['socialVariablePercent'],
            message: t('validation.percentageRange'),
          });
        }
      }

      const wallets = value.socialWallets ?? [];
      if (wallets.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['socialWallets'],
          message: t('validation.addTargetWallet'),
        });
        return;
      }

      let totalBps = 0n;
      let valid = true;
      for (const wallet of wallets) {
        try {
          totalBps += percentageStringToBigInt(wallet.percentage);
        } catch {
          valid = false;
        }
      }
      if (valid && totalBps !== 10000n) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['socialWallets'],
          message: t('validation.targetWalletsTotal100'),
        });
      }
    });
};

export type EnergyOptimizationFormValues = z.infer<
  ReturnType<typeof createEnergyOptimizationSchema>
>;

export const ENERGY_OPTIMIZATION_DEFAULTS: EnergyOptimizationFormValues = {
  purpose1: 'SELF_CONSUMPTION',
  purpose2: 'MIN_CO2',
  purpose3: 'LOWEST_PRICE',
  socialEnabled: false,
  socialMode: 'VARIABLE',
  socialFixedKwh: '',
  socialVariablePercent: '',
  socialWallets: [],
};

// ─────────────────────────────────────────────────────────────────────────
//  Form → contract mapping
// ─────────────────────────────────────────────────────────────────────────

export type EnergyOptimizationContractInput = {
  purposeRanking: EnergyPurposeRanking;
  socialMode: EnergySocialMode;
  socialFixedKwh: string;
  socialVariableBps: number;
  socialWallets: string[];
  socialWalletShares: number[];
};

export const optimizationFormToContract = (
  value: EnergyOptimizationFormValues,
): EnergyOptimizationContractInput => {
  const purposeRanking: EnergyPurposeRanking = [
    value.purpose1,
    value.purpose2,
    value.purpose3,
  ];
  const enabled = Boolean(value.socialEnabled);
  const mode: EnergySocialMode = enabled
    ? value.socialMode ?? 'VARIABLE'
    : 'NONE';

  const socialFixedKwh =
    enabled && mode === 'FIXED' ? value.socialFixedKwh?.trim() || '0' : '0';
  const socialVariableBps =
    enabled && mode === 'VARIABLE'
      ? Number(percentageStringToBigInt(value.socialVariablePercent ?? '0'))
      : 0;

  const wallets = enabled ? value.socialWallets ?? [] : [];

  return {
    purposeRanking,
    socialMode: mode,
    socialFixedKwh,
    socialVariableBps,
    socialWallets: wallets.map((wallet) => wallet.recipient),
    socialWalletShares: wallets.map((wallet) =>
      Number(percentageStringToBigInt(wallet.percentage)),
    ),
  };
};

/** Sum percentage rows to a 0-10000 bps integer, tolerating mid-typing input. */
const sumPercentBps = (
  rows: ReadonlyArray<{ percentage?: string } | undefined> | undefined,
): number => {
  if (!rows) return 0;
  return rows.reduce((acc, row) => {
    if (!row?.percentage) return acc;
    try {
      return acc + Number(percentageStringToBigInt(row.percentage));
    } catch {
      return acc;
    }
  }, 0);
};

// ─────────────────────────────────────────────────────────────────────────
//  Reusable member + percentage split field array
// ─────────────────────────────────────────────────────────────────────────

export const PercentageSplitFieldArray = ({
  name,
  members,
  spaces,
  addLabel,
}: {
  name: string;
  members: Person[];
  spaces?: Space[];
  addLabel: string;
}) => {
  const t = useTranslations('Energy');
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });
  const rows = useWatch({ control, name }) as
    | Array<{ percentage?: string }>
    | undefined;
  const totalBps = sumPercentBps(rows);

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="flex flex-col gap-3 rounded-md border border-border p-3"
        >
          <RecipientField
            name={`${name}.${index}.recipient`}
            members={members}
            spaces={spaces}
            defaultRecipientType="member"
          />
          <div className="flex items-end justify-between gap-2">
            <FormField
              control={control}
              name={`${name}.${index}.percentage`}
              render={({ field: percentField }) => (
                <FormItem>
                  <FormLabel className="text-2 text-neutral-11">
                    {t('optimization.share')}
                  </FormLabel>
                  <FormControl>
                    <ConversionPercentageInput
                      value={percentField.value ?? ''}
                      onChange={percentField.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="button" variant="ghost" onClick={() => remove(index)}>
              <Cross2Icon />
              {t('shared.remove')}
            </Button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <span className="text-1 text-neutral-11">
          {t('shared.totalPercent', { percent: (totalBps / 100).toFixed(2) })}
        </span>
        <Button
          type="button"
          variant="ghost"
          onClick={() => append({ recipient: '', percentage: '' })}
        >
          <PlusIcon />
          {addLabel}
        </Button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
//  Optimization section (Level 1 + Level 2) — shared by both energy forms
// ─────────────────────────────────────────────────────────────────────────

const PrimaryObjectiveField = () => {
  const t = useTranslations('Energy');
  const { control, setValue } = useFormContext();
  const basePurposeOptions = getBasePurposeOptions((key, values) =>
    t(key, values),
  );
  return (
    <FormField
      control={control}
      name="energyOptimization.purpose1"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('optimization.primaryObjective')}</FormLabel>
          <FormControl>
            <div className="flex flex-col gap-3">
              {basePurposeOptions.map(({ value, label, description, icon }) => {
                const selected = field.value === value;
                return (
                  <Card
                    key={value}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected}
                    className={clsx(
                      'flex cursor-pointer items-center space-x-4 border-2 p-5',
                      {
                        'border-accent-9': selected,
                        'hover:border-accent-5': !selected,
                      },
                    )}
                    onClick={() => {
                      field.onChange(value);
                      const [, second, third] = completeRanking(value);
                      setValue('energyOptimization.purpose2', second, {
                        shouldValidate: true,
                      });
                      setValue('energyOptimization.purpose3', third, {
                        shouldValidate: true,
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        field.onChange(value);
                        const [, second, third] = completeRanking(value);
                        setValue('energyOptimization.purpose2', second, {
                          shouldValidate: true,
                        });
                        setValue('energyOptimization.purpose3', third, {
                          shouldValidate: true,
                        });
                      }
                    }}
                  >
                    <div>{icon}</div>
                    <div className="flex flex-col">
                      <span className="text-3 font-medium">{label}</span>
                      <span className="text-1 text-neutral-11">
                        {description}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const EnergyOptimizationFields = () => {
  const t = useTranslations('Energy');

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-1">
        <div className="text-1 font-medium">
          {t('optimization.optimizeFor')}
        </div>
        <p className="text-2 text-secondary-foreground">
          {t('optimization.optimizeDescription')}
        </p>
      </div>
      <PrimaryObjectiveField />
    </div>
  );
};

export const EnergySocialAllocationFields = ({
  members,
  spaces,
}: {
  members: Person[];
  spaces?: Space[];
}) => {
  const t = useTranslations('Energy');
  const { control } = useFormContext();
  const socialModeOptions = getSocialModeOptions((key, values) =>
    t(key, values),
  );
  const socialEnabled = useWatch({
    control,
    name: 'energyOptimization.socialEnabled',
  }) as boolean | undefined;
  const socialMode = useWatch({
    control,
    name: 'energyOptimization.socialMode',
  }) as 'FIXED' | 'VARIABLE' | undefined;

  return (
    <div className="flex flex-col gap-3">
      <FormField
        control={control}
        name="energyOptimization.socialEnabled"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <FormLabel className="text-1 font-medium">
                  {t('optimization.socialAllocation')}
                </FormLabel>
                <p className="text-2 text-secondary-foreground">
                  {t('optimization.socialAllocationDescription')}
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {socialEnabled && (
        <div className="flex flex-col gap-3">
          <FormField
            control={control}
            name="energyOptimization.socialMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('optimization.allocationMode')}</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-auto">
                      <SelectValue placeholder={t('optimization.selectMode')} />
                    </SelectTrigger>
                    <SelectContent className="p-2">
                      {socialModeOptions.map(
                        ({ value, label, description }) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex flex-col text-left">
                              <span className="text-1 font-medium">
                                {label}
                              </span>
                              <span className="text-1 text-neutral-11">
                                {description}
                              </span>
                            </div>
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {socialMode === 'FIXED' && (
            <FormField
              control={control}
              name="energyOptimization.socialFixedKwh"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('optimization.kwhPerInterval')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder={t('optimization.kwhPerIntervalPlaceholder')}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {socialMode === 'VARIABLE' && (
            <FormField
              control={control}
              name="energyOptimization.socialVariablePercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('optimization.shareOfSolar')}</FormLabel>
                  <FormControl>
                    <ConversionPercentageInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <div className="flex flex-col gap-2">
            <FormLabel>{t('optimization.targetWallets')}</FormLabel>
            <p className="text-2 text-secondary-foreground">
              {t('optimization.targetWalletsDescription')}
            </p>
            <PercentageSplitFieldArray
              name="energyOptimization.socialWallets"
              members={members}
              spaces={spaces}
              addLabel={t('optimization.addTargetWallet')}
            />
            <FormField
              control={control}
              name="energyOptimization.socialWallets"
              render={() => (
                <FormItem>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
};

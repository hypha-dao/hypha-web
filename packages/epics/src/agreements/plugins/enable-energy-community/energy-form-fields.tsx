'use client';

import React from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';
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
import { RecipientField } from '../components/common/recipient-field';
import { ConversionPercentageInput } from '../components/common/token-percentage-field';

// ─────────────────────────────────────────────────────────────────────────
//  Option metadata (REC memo Level 1 + Level 2)
// ─────────────────────────────────────────────────────────────────────────

export const BASE_PURPOSE_OPTIONS: ReadonlyArray<{
  value: EnergyBasePurpose;
  label: string;
  description: string;
}> = [
  {
    value: 'SELF_CONSUMPTION',
    label: 'Maximum Self-Consumption',
    description:
      'Use locally generated energy within the community before any grid interaction.',
  },
  {
    value: 'MIN_CO2',
    label: 'Minimum CO₂ Emissions',
    description:
      'Minimise the lifecycle carbon intensity of every unit consumed.',
  },
  {
    value: 'LOWEST_PRICE',
    label: 'Lowest Price',
    description:
      'Minimise total energy cost, actively exploiting market price dynamics.',
  },
];

export const SOCIAL_MODE_OPTIONS: ReadonlyArray<{
  value: 'FIXED' | 'VARIABLE';
  label: string;
  description: string;
}> = [
  {
    value: 'VARIABLE',
    label: 'Variable (% of solar)',
    description:
      'Ring-fence a percentage of actual solar generation each interval.',
  },
  {
    value: 'FIXED',
    label: 'Fixed (kWh per interval)',
    description:
      'Ring-fence a fixed number of kWh each 15-minute interval (grid tops up shortfalls).',
  },
];

export const basePurposeLabel = (value: string): string =>
  BASE_PURPOSE_OPTIONS.find((option) => option.value === value)?.label ?? value;

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
  return [primary, rest[0], rest[1]];
};

// ─────────────────────────────────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────────────────────────────────

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const percentageString = z
  .string()
  .trim()
  .refine((value) => {
    try {
      percentageStringToBigInt(value);
      return true;
    } catch {
      return false;
    }
  }, 'Enter a percentage between 0 and 100');

const memberPercentRow = z.object({
  recipient: z.string().trim().regex(ADDRESS_RE, 'Select a member'),
  percentage: percentageString,
});

const purposeEnum = z.enum(ENERGY_BASE_PURPOSES);

export const energyOptimizationSchema = z
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
    if (new Set([value.purpose1, value.purpose2, value.purpose3]).size !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['purpose3'],
        message: 'Each priority must be a different objective',
      });
    }

    if (!value.socialEnabled) return;

    if (!value.socialMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['socialMode'],
        message: 'Select a social allocation mode',
      });
    }

    if (value.socialMode === 'FIXED') {
      if (!value.socialFixedKwh || !/^\d+$/.test(value.socialFixedKwh)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['socialFixedKwh'],
          message: 'Enter a whole number of kWh per interval',
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
          message: 'Enter a percentage between 0 and 100',
        });
      }
    }

    const wallets = value.socialWallets ?? [];
    if (wallets.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['socialWallets'],
        message: 'Add at least one goal wallet',
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
        message: 'Goal wallet shares must total 100%',
      });
    }
  });

export type EnergyOptimizationFormValues = z.infer<
  typeof energyOptimizationSchema
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
            showTabs={false}
          />
          <div className="flex items-end justify-between gap-2">
            <FormField
              control={control}
              name={`${name}.${index}.percentage`}
              render={({ field: percentField }) => (
                <FormItem>
                  <FormLabel className="text-2 text-neutral-11">
                    Share
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
              Remove
            </Button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <span className="text-1 text-neutral-11">
          Total: {(totalBps / 100).toFixed(2)}%
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
  const { control, setValue } = useFormContext();
  return (
    <FormField
      control={control}
      name="energyOptimization.purpose1"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Primary objective</FormLabel>
          <FormControl>
            <Select
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                const [, second, third] = completeRanking(
                  value as EnergyBasePurpose,
                );
                setValue('energyOptimization.purpose2', second, {
                  shouldValidate: true,
                });
                setValue('energyOptimization.purpose3', third, {
                  shouldValidate: true,
                });
              }}
            >
              <SelectTrigger className="h-auto">
                <SelectValue placeholder="Select an objective" />
              </SelectTrigger>
              <SelectContent className="p-2">
                {BASE_PURPOSE_OPTIONS.map(({ value, label, description }) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex flex-col text-left">
                      <span className="text-1 font-medium">{label}</span>
                      <span className="text-1 text-neutral-11">
                        {description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const EnergyOptimizationFields = ({
  members,
  spaces,
}: {
  members: Person[];
  spaces?: Space[];
}) => {
  const { control } = useFormContext();
  const socialEnabled = useWatch({
    control,
    name: 'energyOptimization.socialEnabled',
  }) as boolean | undefined;
  const socialMode = useWatch({
    control,
    name: 'energyOptimization.socialMode',
  }) as 'FIXED' | 'VARIABLE' | undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-1">
          <div className="text-1 font-medium">Optimize community for</div>
          <p className="text-2 text-secondary-foreground">
            Choose the community&rsquo;s main objective. The energy management
            system optimises for it first, then balances the remaining
            objectives automatically.
          </p>
        </div>
        <PrimaryObjectiveField />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <FormField
          control={control}
          name="energyOptimization.socialEnabled"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <FormLabel className="text-1 font-medium">
                    Social allocation
                  </FormLabel>
                  <p className="text-2 text-secondary-foreground">
                    Ring-fence part of solar production for community goal
                    wallets before the optimisation runs.
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
                  <FormLabel>Allocation mode</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-auto">
                        <SelectValue placeholder="Select a mode" />
                      </SelectTrigger>
                      <SelectContent className="p-2">
                        {SOCIAL_MODE_OPTIONS.map(
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
                    <FormLabel>kWh per 15-minute interval</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="e.g. 1000"
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
                    <FormLabel>Share of solar generation</FormLabel>
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
              <FormLabel>Goal wallets</FormLabel>
              <p className="text-2 text-secondary-foreground">
                Distribute the social allocation across goal wallets (shares
                total 100%).
              </p>
              <PercentageSplitFieldArray
                name="energyOptimization.socialWallets"
                members={members}
                spaces={spaces}
                addLabel="Add goal wallet"
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
    </div>
  );
};

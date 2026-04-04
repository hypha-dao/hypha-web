'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  RequirementMark,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export const TOKEN_TYPE_OPTIONS = [
  {
    value: 'utility',
    label: 'Utility Token',
    description: 'used for access or functionality within the space',
  },
  {
    value: 'ownership',
    label: 'Ownership Token',
    description: 'reflects stake or equity in the space',
  },
  {
    value: 'impact',
    label: 'Impact Token',
    description:
      'values measurable social, economic, and environmental outcomes',
  },
  {
    value: 'credits',
    label: 'Cash Credits',
    description: 'redeemable credits that can be exchanged for fiat currency',
  },
  {
    value: 'voice',
    label: 'Voice Token',
    description:
      'provides a voice in management or decision making within the space',
  },
  {
    value: 'community_currency',
    label: 'Community Currency',
    description:
      'local currency used for transactions and value exchange within the community',
  },
];

export const TOKEN_TYPE_I18N_KEYS = {
  utility: {
    label: 'plugins.issueNewToken.general.tokenTypeOptions.utility.label',
    description:
      'plugins.issueNewToken.general.tokenTypeOptions.utility.description',
  },
  ownership: {
    label: 'plugins.issueNewToken.general.tokenTypeOptions.ownership.label',
    description:
      'plugins.issueNewToken.general.tokenTypeOptions.ownership.description',
  },
  impact: {
    label: 'plugins.issueNewToken.general.tokenTypeOptions.impact.label',
    description:
      'plugins.issueNewToken.general.tokenTypeOptions.impact.description',
  },
  credits: {
    label: 'plugins.issueNewToken.general.tokenTypeOptions.credits.label',
    description:
      'plugins.issueNewToken.general.tokenTypeOptions.credits.description',
  },
  voice: {
    label: 'plugins.issueNewToken.general.tokenTypeOptions.voice.label',
    description:
      'plugins.issueNewToken.general.tokenTypeOptions.voice.description',
  },
  community_currency: {
    label:
      'plugins.issueNewToken.general.tokenTypeOptions.community_currency.label',
    description:
      'plugins.issueNewToken.general.tokenTypeOptions.community_currency.description',
  },
} as const;

export function getTokenTypeLabel(type: string, tAgreementFlow?: any): string {
  const tokenTypeI18nKeys =
    TOKEN_TYPE_I18N_KEYS[type as keyof typeof TOKEN_TYPE_I18N_KEYS];

  if (tokenTypeI18nKeys?.label && tAgreementFlow) {
    return tAgreementFlow(
      tokenTypeI18nKeys.label as Parameters<typeof tAgreementFlow>[0],
    );
  }

  return TOKEN_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function getTokenTypeDescription(
  type: string,
  tAgreementFlow?: (key: string) => string,
): string {
  const keys = TOKEN_TYPE_I18N_KEYS[type as keyof typeof TOKEN_TYPE_I18N_KEYS];
  if (keys?.description && tAgreementFlow) {
    return tAgreementFlow(
      keys.description as Parameters<typeof tAgreementFlow>[0],
    );
  }
  return TOKEN_TYPE_OPTIONS.find((o) => o.value === type)?.description ?? '';
}

type TokenTypeFieldProps = {
  onValueChange?: (value: string) => void;
};

export function TokenTypeField({ onValueChange }: TokenTypeFieldProps) {
  const { control } = useFormContext();
  const tAgreementFlow = useTranslations('AgreementFlow');

  const tokenTypeOptions = TOKEN_TYPE_OPTIONS.map((option) => ({
    ...option,
    label: tAgreementFlow(
      TOKEN_TYPE_I18N_KEYS[option.value as keyof typeof TOKEN_TYPE_I18N_KEYS]
        .label as Parameters<typeof tAgreementFlow>[0],
    ),
    description: tAgreementFlow(
      TOKEN_TYPE_I18N_KEYS[option.value as keyof typeof TOKEN_TYPE_I18N_KEYS]
        .description as Parameters<typeof tAgreementFlow>[0],
    ),
  }));

  return (
    <FormField
      control={control}
      name="type"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full gap-1">
              {tAgreementFlow('plugins.issueNewToken.general.tokenTypeLabel')}{' '}
              <RequirementMark className="text-2" />
            </FormLabel>
            <FormControl>
              <Select
                value={field.value}
                onValueChange={(value: string) => {
                  field.onChange(value);
                  onValueChange?.(value);
                }}
              >
                <SelectTrigger className="h-auto">
                  <SelectValue
                    placeholder={tAgreementFlow(
                      'plugins.issueNewToken.general.tokenTypePlaceholder',
                    )}
                  />
                </SelectTrigger>
                <SelectContent className="p-2">
                  {tokenTypeOptions.map(({ value, label, description }) => (
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
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

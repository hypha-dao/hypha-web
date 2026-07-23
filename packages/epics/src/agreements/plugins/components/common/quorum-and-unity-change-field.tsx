'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { useTheme } from 'next-themes';
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from '@hypha-platform/ui';
import { QuorumAndUnityChanger } from './quorum-and-unity-changer';
import { Button } from '@hypha-platform/ui';
import { VOTING_METHOD_TEMPLATES } from '../../../../governance';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

interface QuorumAndUnityChangerFieldProps {
  name: string;
}

export function QuorumAndUnityChangerField({
  name,
}: QuorumAndUnityChangerFieldProps) {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { control, setValue } = useFormContext();
  const fieldValue = useWatch({ control, name }) || { quorum: 0, unity: 0 };
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const matchedPreset = VOTING_METHOD_TEMPLATES.find(
    (p) => p.quorum === fieldValue.quorum && p.unity === fieldValue.unity,
  );

  const handleChange = (values: { quorum: number; unity: number }) => {
    setValue(name, values, { shouldValidate: true });
  };

  const handlePresetClick = (preset: {
    title: string;
    titleKey: string;
    quorum: number;
    unity: number;
  }) => {
    setValue(
      name,
      { quorum: preset.quorum, unity: preset.unity },
      { shouldValidate: true },
    );
  };

  const getTextColor = (value: number) => {
    if (value >= 50) {
      return 'text-white';
    }
    if (value === 0) {
      return isDark ? 'text-white' : 'text-accent-9';
    }
    return isDark ? 'text-white' : 'text-accent-9';
  };

  return (
    <FormField
      control={control}
      name={name}
      render={() => (
        <FormItem>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-2">
            {VOTING_METHOD_TEMPLATES.map((preset) => {
              const isSelected = matchedPreset === preset;
              return (
                <Button
                  key={preset.title}
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    'flex h-full flex-col items-start rounded-xl p-4 text-left shadow-sm transition-colors',
                    'border bg-card hover:bg-muted/45 dark:hover:bg-muted/25',
                    /* Button adds focus-visible:ring-ring — override so focus matches space accent (not gray until blur). */
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--space-accent,var(--color-accent-9))] focus-visible:ring-offset-0',
                    isSelected
                      ? 'border-transparent bg-[color-mix(in_oklab,var(--space-accent,var(--color-accent-9))_12%,var(--card))] ring-2 ring-[var(--space-accent,var(--color-accent-9))] ring-offset-0 dark:bg-[color-mix(in_oklab,var(--space-accent,var(--color-accent-9))_18%,var(--card))]'
                      : 'border-border/90',
                  )}
                >
                  <div className="mb-2 font-semibold text-foreground">
                    {tAgreementFlow(
                      `plugins.quorumAndUnity.templates.${preset.titleKey}` as Parameters<
                        typeof tAgreementFlow
                      >[0],
                    )}
                  </div>
                  <div className="w-full space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="relative h-5 flex-1 rounded-lg bg-muted">
                        <div
                          className="h-5 rounded-lg bg-[color-mix(in_oklab,var(--space-accent,var(--color-accent-9))_90%,transparent)]"
                          style={{
                            width: `${preset.quorum}%`,
                          }}
                        />
                        <span
                          className={`absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-xs ${getTextColor(
                            preset.quorum,
                          )}`}
                        >
                          {preset.quorum}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative h-5 flex-1 rounded-lg bg-muted">
                        <div
                          className="h-5 rounded-lg bg-[color-mix(in_oklab,var(--space-accent,var(--color-accent-9))_90%,transparent)]"
                          style={{
                            width: `${preset.unity}%`,
                          }}
                        />
                        <span
                          className={`absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-xs ${getTextColor(
                            preset.unity,
                          )}`}
                        >
                          {preset.unity}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
          <FormControl>
            <QuorumAndUnityChanger
              quorum={fieldValue.quorum}
              unity={fieldValue.unity}
              onChange={handleChange}
            />
          </FormControl>
          <FormMessage />
          {fieldValue.quorum === 0 && fieldValue.unity === 0 && (
            <span className="text-2 text-error-11 mt-2">
              {tAgreementFlow('plugins.quorumAndUnity.cannotBothZero')}
            </span>
          )}
        </FormItem>
      )}
    />
  );
}

'use client';

import React from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Input,
  FormLabel,
  RequirementMark,
} from '@hypha-platform/ui';
import { PercentIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { handleNumberChange } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

type TimeFormat = 'Weeks' | 'Months' | 'Years';

const TIME_FORMAT_TO_SECONDS: Record<TimeFormat, number> = {
  Weeks: 604800,
  Months: 2592000,
  Years: 31536000,
};

type DecaySettingsOutput = {
  decayInterval: number | string;
  decayPercentage: number;
};

type DecaySettingsProps = {
  value?: DecaySettingsOutput;
  onChange?: (value: DecaySettingsOutput) => void;
};

/** Match interval (seconds) to Weeks/Months/Years like the original Object.entries scan. */
function inferTimeFormatAndPeriod(intervalSeconds: number): {
  format: TimeFormat;
  period: number;
} {
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    return { format: 'Weeks', period: 1 };
  }
  for (const [fmt, sec] of Object.entries(TIME_FORMAT_TO_SECONDS) as [
    TimeFormat,
    number,
  ][]) {
    if (intervalSeconds % sec === 0) {
      return { format: fmt, period: intervalSeconds / sec };
    }
  }
  return {
    format: 'Weeks',
    period: Math.max(
      1,
      Math.round(intervalSeconds / TIME_FORMAT_TO_SECONDS.Weeks),
    ),
  };
}

export const DecaySettings = ({ value, onChange }: DecaySettingsProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');

  const derivedFromValue = React.useMemo(() => {
    if (
      !value ||
      typeof value.decayInterval !== 'number' ||
      value.decayInterval <= 0
    ) {
      return null;
    }
    const { format, period } = inferTimeFormatAndPeriod(value.decayInterval);
    const pct =
      typeof value.decayPercentage === 'number' &&
      value.decayPercentage >= 1 &&
      value.decayPercentage <= 100
        ? value.decayPercentage
        : 1;
    return { format, period, pct };
  }, [value?.decayInterval, value?.decayPercentage]);

  const [timeFormat, setTimeFormat] = React.useState<TimeFormat>(
    () => derivedFromValue?.format ?? 'Weeks',
  );

  const { setValue, control } = useFormContext();

  const decayPeriod = useWatch({
    control,
    name: 'decayPeriod',
    defaultValue: derivedFromValue?.period ?? 1,
  });

  const decayPercent = useWatch({
    control,
    name: 'decayPercent',
    defaultValue: derivedFromValue?.pct ?? 1,
  });

  /** When parent `value` updates (chain hydration, token switch), sync local RHF fields — useWatch defaultValue only applies once. */
  React.useEffect(() => {
    if (!derivedFromValue) {
      return;
    }
    setTimeFormat(derivedFromValue.format);
    setValue('decayPeriod', derivedFromValue.period, {
      shouldDirty: false,
      shouldValidate: false,
    });
    setValue('decayPercent', derivedFromValue.pct, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [derivedFromValue, setValue]);

  const notifyChange = React.useCallback(() => {
    if (!onChange) {
      return;
    }
    if (
      typeof decayPeriod !== 'number' ||
      decayPeriod <= 0 ||
      Number.isNaN(decayPeriod)
    ) {
      return;
    }
    if (
      typeof decayPercent !== 'number' ||
      decayPercent < 1 ||
      decayPercent > 100 ||
      Number.isNaN(decayPercent)
    ) {
      return;
    }
    const decayInterval = decayPeriod * TIME_FORMAT_TO_SECONDS[timeFormat];
    if (!Number.isFinite(decayInterval) || decayInterval <= 0) {
      return;
    }
    onChange({
      decayInterval,
      decayPercentage: decayPercent,
    });
  }, [onChange, decayPeriod, timeFormat, decayPercent]);

  React.useEffect(() => {
    notifyChange();
  }, [notifyChange]);

  const handleDecayPeriodChange = handleNumberChange(setValue, 'decayPeriod');

  const handleTimeFormatChange = (val: string) => {
    const format = val as TimeFormat;
    setTimeFormat(format);
  };

  const handleDecayPercentChange = handleNumberChange(setValue, 'decayPercent');

  return (
    <>
      <div className="flex justify-between items-center gap-3">
        <FormLabel className="text-2 text-neutral-11 gap-1">
          {tAgreementFlow('plugins.issueNewToken.decay.frequencyLabel')}{' '}
          <RequirementMark className="text-2" />
        </FormLabel>
        <div className="flex justify-between flex-row flex-1 gap-3 max-w-[50%]">
          <div className="flex flex-col flex-1 min-w-10">
            <Input
              id="decay-period"
              type="number"
              value={decayPeriod}
              onChange={handleDecayPeriodChange}
              placeholder={tAgreementFlow(
                'plugins.issueNewToken.decay.frequencyPlaceholder',
              )}
            />
          </div>

          <div className="flex flex-col flex-1">
            <Select value={timeFormat} onValueChange={handleTimeFormatChange}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={tAgreementFlow(
                    'plugins.issueNewToken.decay.timeFormatPlaceholder',
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Weeks">
                  {tAgreementFlow(
                    'plugins.issueNewToken.decay.timeFormats.weeks',
                  )}
                </SelectItem>
                <SelectItem value="Months">
                  {tAgreementFlow(
                    'plugins.issueNewToken.decay.timeFormats.months',
                  )}
                </SelectItem>
                <SelectItem value="Years">
                  {tAgreementFlow(
                    'plugins.issueNewToken.decay.timeFormats.years',
                  )}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center gap-3">
        <FormLabel className="text-2 text-neutral-11 gap-1">
          {tAgreementFlow('plugins.issueNewToken.decay.percentageLabel')}{' '}
          <RequirementMark className="text-2" />
        </FormLabel>
        <div className="flex flex-col flex-1 max-w-[25%]">
          <Input
            id="decay-percent"
            type="number"
            min={0}
            max={100}
            value={decayPercent}
            onChange={handleDecayPercentChange}
            placeholder={tAgreementFlow(
              'plugins.issueNewToken.decay.percentagePlaceholder',
            )}
            rightIcon={<PercentIcon size={'14px'} />}
          />
        </div>
      </div>
    </>
  );
};

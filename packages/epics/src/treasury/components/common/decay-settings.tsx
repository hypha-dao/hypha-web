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

export const DecaySettings = ({ value, onChange }: DecaySettingsProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const initialTimeFormat = value
    ? (Object.entries(TIME_FORMAT_TO_SECONDS).find(
        ([_, seconds]) => (value.decayInterval as number) % seconds === 0,
      )?.[0] as TimeFormat) || 'Weeks'
    : 'Weeks';

  const [timeFormat, setTimeFormat] =
    React.useState<TimeFormat>(initialTimeFormat);
  const { setValue, control } = useFormContext();

  const decayPeriod = useWatch({
    control,
    name: 'decayPeriod',
    defaultValue: value
      ? (value.decayInterval as number) /
        TIME_FORMAT_TO_SECONDS[initialTimeFormat]
      : 0,
  });

  const decayPercent = useWatch({
    control,
    name: 'decayPercent',
    defaultValue: value ? value.decayPercentage : 0,
  });

  React.useEffect(() => {
    notifyChange();
  }, [decayPeriod, timeFormat, decayPercent]);

  const notifyChange = () => {
    if (onChange && !Number.isNaN(decayPeriod) && !Number.isNaN(decayPercent)) {
      const decayInterval =
        typeof decayPeriod === 'string'
          ? ''
          : decayPeriod * TIME_FORMAT_TO_SECONDS[timeFormat];
      onChange({
        decayInterval,
        decayPercentage: decayPercent,
      });
    }
  };

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

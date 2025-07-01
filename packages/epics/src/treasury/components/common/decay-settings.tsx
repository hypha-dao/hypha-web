import React from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Input,
} from '@hypha-platform/ui';
import { PercentIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';

type TimeFormat = 'Minutes' | 'Hours' | 'Days' | 'Weeks' | 'Months';

const TIME_FORMAT_TO_SECONDS: Record<TimeFormat, number> = {
  Minutes: 60,
  Hours: 3600,
  Days: 86400,
  Weeks: 604800,
  Months: 2592000,
};

type DecaySettingsInternal = {
  decayPeriod: number | '';
  timeFormat: TimeFormat;
  decayPercent: number | '';
};

type DecaySettingsOutput = {
  decayInterval: number;
  decayPercentage: number;
};

type DecaySettingsProps = {
  value?: DecaySettingsOutput;
  onChange?: (value: DecaySettingsOutput) => void;
};

export const DecaySettings = ({ value, onChange }: DecaySettingsProps) => {
  const [timeFormat, setTimeFormat] = React.useState<TimeFormat>('Weeks');
  const { setValue, control } = useFormContext();

  const decayPeriod = useWatch({
    control,
    name: 'decayPeriod',
    defaultValue: 0,
  });

  const decayPercent = useWatch({
    control,
    name: 'decayPercent',
    defaultValue: 0,
  });

  React.useEffect(() => {
    notifyChange();
  }, [decayPeriod, timeFormat, decayPercent]);

  const notifyChange = () => {
    if (onChange && !Number.isNaN(decayPeriod) && !Number.isNaN(decayPercent)) {
      const decayInterval = decayPeriod * TIME_FORMAT_TO_SECONDS[timeFormat];
      onChange({
        decayInterval,
        decayPercentage: decayPercent,
      });
    }
  };

  const handleDecayPeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const num = Number.isNaN(val) ? 0 : val;
    setValue('decayPeriod', num);
  };

  const handleTimeFormatChange = (val: string) => {
    const format = val as TimeFormat;
    setTimeFormat(format);
  };

  const handleDecayPercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const num = Number.isNaN(val) ? 0 : val;
    setValue('decayPercent', num);
  };

  return (
    <>
      <div className="flex justify-between items-center gap-3">
        <div className="text-2 text-neutral-11 font-medium">
          Voice Decay Period
        </div>

        <div className="flex justify-between flex-row flex-1 gap-3 max-w-[50%]">
          <div className="flex flex-col flex-1 min-w-10">
            <Input
              id="decay-period"
              type="number"
              value={decayPeriod}
              onChange={handleDecayPeriodChange}
              placeholder="Decay period"
            />
          </div>

          <div className="flex flex-col flex-1">
            <Select value={timeFormat} onValueChange={handleTimeFormatChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select time format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Minutes">Minutes</SelectItem>
                <SelectItem value="Hours">Hours</SelectItem>
                <SelectItem value="Days">Days</SelectItem>
                <SelectItem value="Weeks">Weeks</SelectItem>
                <SelectItem value="Months">Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center gap-3">
        <div className="text-2 text-neutral-11 font-medium">
          Voice Decay Percentage
        </div>

        <div className="flex flex-col flex-1 max-w-[25%]">
          <Input
            id="decay-percent"
            type="number"
            min={1}
            max={100}
            value={decayPercent}
            onChange={handleDecayPercentChange}
            placeholder="Decay"
            rightIcon={<PercentIcon size={'14px'} />}
          />
        </div>
      </div>
    </>
  );
};

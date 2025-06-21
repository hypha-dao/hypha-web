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
  const [decayPeriod, setDecayPeriod] = React.useState<number | ''>(1);
  const [timeFormat, setTimeFormat] = React.useState<TimeFormat>('Weeks');
  const [decayPercent, setDecayPercent] = React.useState<number | ''>(5);

  React.useEffect(() => {
    notifyChange();
  }, [decayPeriod, timeFormat, decayPercent]);

  const notifyChange = () => {
    if (onChange && decayPeriod !== '' && decayPercent !== '') {
      const decayInterval = decayPeriod * TIME_FORMAT_TO_SECONDS[timeFormat];
      onChange({
        decayInterval,
        decayPercentage: decayPercent,
      });
    }
  };

  const handleDecayPeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const num = val === '' ? '' : Number(val);
    setDecayPeriod(num);
  };

  const handleTimeFormatChange = (val: string) => {
    const format = val as TimeFormat;
    setTimeFormat(format);
  };

  const handleDecayPercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const num = val === '' ? '' : Number(val);
    setDecayPercent(num);
  };

  return (
    <div className="flex gap-4 items-center">
      <div className="flex flex-col flex-1">
        <Input
          id="decay-period"
          type="number"
          value={decayPeriod === '' ? '' : decayPeriod}
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

      <div className="flex flex-col flex-1">
        <Input
          id="decay-percent"
          type="number"
          min={1}
          max={100}
          value={decayPercent === '' ? '' : decayPercent}
          onChange={handleDecayPercentChange}
          placeholder="Decay"
          rightIcon={<PercentIcon size={'14px'} />}
        />
      </div>
    </div>
  );
};

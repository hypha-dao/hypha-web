'use client';

import { useState } from 'react';
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

const TEMPLATES = [
  { title: '80-20 Pareto', quorum: 20, unity: 80 },
  { title: 'Majority Vote', quorum: 51, unity: 51 },
  { title: 'Minority Vote', quorum: 10, unity: 90 },
  { title: 'Consensus', quorum: 100, unity: 100 },
  { title: 'Consent', quorum: 0, unity: 100 },
  { title: 'Hearing', quorum: 100, unity: 0 },
];

interface QuorumAndUnityChangerFieldProps {
  name: string;
}

export function QuorumAndUnityChangerField({
  name,
}: QuorumAndUnityChangerFieldProps) {
  const { control, setValue } = useFormContext();
  const fieldValue = useWatch({ control, name }) || { quorum: 0, unity: 0 };
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const handleChange = (values: { quorum: number; unity: number }) => {
    setValue(name, values, { shouldValidate: true });
    const preset = TEMPLATES.find(
      (p) => p.quorum === values.quorum && p.unity === values.unity,
    );
    if (!preset) {
      setSelectedPreset(null);
    }
  };

  const handlePresetClick = (preset: {
    title: string;
    quorum: number;
    unity: number;
  }) => {
    setSelectedPreset(preset.title);
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
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {TEMPLATES.map((preset) => {
              const isSelected = selectedPreset === preset.title;
              return (
                <Button
                  key={preset.title}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`flex flex-col items-start h-full rounded-xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-accent-11'
                      : 'border-neutral-7 hover:border-neutral-9'
                  }`}
                  variant="ghost"
                >
                  <div className="font-bold mb-2">{preset.title}</div>
                  <div className="space-y-3 text-sm text-neutral-11 w-full">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-neutral-3 h-5 rounded-2xl relative">
                        <div
                          className="bg-accent-9 h-5 rounded-2xl"
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
                      <div className="flex-1 bg-neutral-3 h-5 rounded-2xl relative">
                        <div
                          className="bg-accent-9 h-5 rounded-2xl"
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
          <span className="text-neutral-11 text-2">
            Optional: Adjust the Quorum and Unity sliders to refine the selected
            voting method template.
          </span>
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
              Quorum and unity cannot both be set to 0%
            </span>
          )}
        </FormItem>
      )}
    />
  );
}

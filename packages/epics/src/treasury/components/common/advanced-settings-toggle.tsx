'use client';

import { FormLabel, Switch } from '@hypha-platform/ui';

export const AdvancedSettingsToggle = ({
  showAdvancedSettings,
  setShowAdvancedSettings,
}: {
  showAdvancedSettings: boolean;
  setShowAdvancedSettings: (value: boolean) => void;
}) => {
  return (
    <div className="flex flex-col gap-4">
      <FormLabel>Advanced Token Settings</FormLabel>
      <span className="text-2 text-neutral-11">
        Activate advanced settings to access detailed controls for token supply,
        minting permissions, burn rules, transfer policies, and initial token
        pricing.
      </span>
      <div className="flex w-full justify-between items-center text-2 text-neutral-11">
        <span>Enable Token Advanced Settings</span>
        <Switch
          checked={showAdvancedSettings}
          onCheckedChange={setShowAdvancedSettings}
          className="ml-2"
        />
      </div>
    </div>
  );
};

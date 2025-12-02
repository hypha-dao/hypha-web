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
      <FormLabel>Advanced Token Settings (Optional)</FormLabel>
      <span className="text-2 text-neutral-11">
        Defaults are pre-configured for standard use. Only enable advanced
        settings if you'd like to configure supply caps, manual minting,
        transfer policies and whitelists, or set a token value.
      </span>
      <div className="flex w-full justify-between items-center text-2 text-neutral-11">
        <span>Enable Advanced Settings</span>
        <Switch
          checked={showAdvancedSettings}
          onCheckedChange={setShowAdvancedSettings}
          className="ml-2"
        />
      </div>
    </div>
  );
};

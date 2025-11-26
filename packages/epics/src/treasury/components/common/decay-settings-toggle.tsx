'use client';

import { Switch } from '@hypha-platform/ui';

export const DecaySettingsToggle = ({
  showDecaySettings,
  setShowDecaySettings,
}: {
  showDecaySettings: boolean;
  setShowDecaySettings: (value: boolean) => void;
}) => {
  return (
    <div className="flex items-center gap-3 justify-between">
      <label
        htmlFor="decay-settings-toggle"
        className="text-2 text-neutral-11 font-medium"
      >
        Advanced Decay Settings
      </label>
      <Switch
        id="decay-settings-toggle"
        checked={showDecaySettings}
        onCheckedChange={setShowDecaySettings}
      />
    </div>
  );
};

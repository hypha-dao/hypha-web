'use client';

import { FormLabel, Switch } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export const AdvancedSettingsToggle = ({
  showAdvancedSettings,
  setShowAdvancedSettings,
}: {
  showAdvancedSettings: boolean;
  setShowAdvancedSettings: (value: boolean) => void;
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>
        {tAgreementFlow('plugins.issueNewToken.advancedSettings.title')}
      </FormLabel>
      <span className="text-2 text-neutral-11">
        {tAgreementFlow('plugins.issueNewToken.advancedSettings.description')}
      </span>
      <div className="flex w-full justify-between items-center text-2 text-neutral-11">
        <span>
          {tAgreementFlow('plugins.issueNewToken.advancedSettings.enable')}
        </span>
        <Switch
          checked={showAdvancedSettings}
          onCheckedChange={setShowAdvancedSettings}
          className="ml-2"
        />
      </div>
    </div>
  );
};

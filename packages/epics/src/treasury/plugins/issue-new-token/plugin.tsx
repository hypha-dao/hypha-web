'use client';

import {
  TokenNameField,
  TokenSymbolField,
  TokenIconField,
  // TokenDescriptionField,
  // TokenDigitsField,
  TokenTypeField,
  TokenMaxSupplyField,
} from '../../components';
import { DecaySettingsField } from '../../components/common/decay-settings-field';

export const IssueNewTokenPlugin = () => {
  return (
    <div className="flex flex-col gap-4">
      <TokenNameField />
      <TokenSymbolField />
      <TokenIconField />
      {/* <TokenDescriptionField /> */}
      {/* <TokenDigitsField /> */}
      <TokenTypeField />
      <TokenMaxSupplyField />
      <DecaySettingsField name="decaySettings" />
    </div>
  );
};

'use client';

import { FormLabel } from '@hypha-platform/ui';
import {
  getTokenTypeDescription,
  getTokenTypeLabel,
  TokenTypeField,
} from './token-type-field';
import { TokenNameField } from './token-name-field';
import { TokenSymbolField } from './token-symbol-field';
import { TokenIconField } from './token-icon-field';
import { useTranslations } from 'next-intl';
import React from 'react';

export const GeneralTokenSettings = ({
  tokenType,
  setTokenType,
  showChooseType = true,
}: {
  tokenType: string;
  setTokenType: (value: string) => void;
  showChooseType?: boolean;
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const label = getTokenTypeLabel(tokenType, tAgreementFlow);
  const description = getTokenTypeDescription(tokenType, tAgreementFlow);

  return (
    <>
      <FormLabel>
        {tAgreementFlow('plugins.issueNewToken.general.title')}
      </FormLabel>
      {showChooseType ? (
        <span className="text-2 text-neutral-11">
          {tAgreementFlow('plugins.issueNewToken.general.description')}
        </span>
      ) : (
        <span className="text-2 text-neutral-11">
          {tAgreementFlow(
            'plugins.issueNewToken.general.customizeIdentityDescription',
          )}
        </span>
      )}
      {showChooseType ? (
        <TokenTypeField
          onValueChange={(value: string) => {
            setTokenType(value);
          }}
        />
      ) : (
        <div className="text-2 text-neutral-11 w-full gap-1">
          <div className="text-1 font-medium">{label}</div>
          <div className="text-1 text-neutral-11">{description}</div>
        </div>
      )}
      <TokenNameField />
      <TokenSymbolField />
      <TokenIconField />
    </>
  );
};

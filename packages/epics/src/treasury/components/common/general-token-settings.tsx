'use client';

import { FormLabel } from '@hypha-platform/ui';
import { TokenTypeField } from './token-type-field';
import { TokenNameField } from './token-name-field';
import { TokenSymbolField } from './token-symbol-field';
import { TokenIconField } from './token-icon-field';
import { useTranslations } from 'next-intl';

export const GeneralTokenSettings = ({
  tokenType,
  setTokenType,
}: {
  tokenType: string;
  setTokenType: (value: string) => void;
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <>
      <FormLabel>
        {tAgreementFlow('plugins.issueNewToken.general.title')}
      </FormLabel>
      <span className="text-2 text-neutral-11">
        {tAgreementFlow('plugins.issueNewToken.general.description')}
      </span>
      <TokenTypeField
        onValueChange={(value: string) => {
          setTokenType(value);
        }}
      />
      <TokenNameField />
      <TokenSymbolField />
      <TokenIconField />
    </>
  );
};

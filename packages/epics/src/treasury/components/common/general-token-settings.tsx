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
  const label = React.useMemo(() => {
    return getTokenTypeLabel(tokenType);
  }, [tokenType]);
  const description = React.useMemo(() => {
    return getTokenTypeDescription(tokenType);
  }, [tokenType]);
  return (
    <>
      <FormLabel>General</FormLabel>
      {showChooseType ? (
        <span className="text-2 text-neutral-11">
          Select your token type and customize its name, symbol, and icon for
          clear identification.
        </span>
      ) : (
        <span className="text-2 text-neutral-11">
          Customize token name, symbol, and icon for clear identification.
        </span>
      )}
      {showChooseType ? (
        <TokenTypeField
          onValueChange={(value: string) => {
            setTokenType(value);
          }}
        />
      ) : (
        <div className="flex flex-col text-left">
          <span className="text-1 font-medium">{label}</span>
          <span className="text-1 text-neutral-11">{description}</span>
        </div>
      )}
      <TokenNameField />
      <TokenSymbolField />
      <TokenIconField />
    </>
  );
};

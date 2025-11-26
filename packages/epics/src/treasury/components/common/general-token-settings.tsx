import { FormLabel } from '@hypha-platform/ui';
import { TokenTypeField } from './token-type-field';
import { TokenNameField } from './token-name-field';
import { TokenSymbolField } from './token-symbol-field';
import { TokenIconField } from './token-icon-field';

export const GeneralTokenSettings = ({
  tokenType,
  setTokenType,
}: {
  tokenType: string;
  setTokenType: (value: string) => void;
}) => {
  return (
    <>
      <FormLabel>General</FormLabel>
      <span className="text-2 text-neutral-11">
        Select your token type and customize its name, symbol, and icon for
        clear identification.
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

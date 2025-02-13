import { CopyIcon } from '@radix-ui/react-icons';
import { copyToClipboard } from '../../../../ui-utils/src/copyToClipboard';

interface EthAdressProps {
  address?: string;
  hasCopyButton?: boolean;
}

export const EthAddress = ({ address, hasCopyButton }: EthAdressProps) => {
  const copy = (text: string) => {
    if (hasCopyButton) {
      copyToClipboard(text);
    }
  };

  if (!address) return null;

  return (
    <div onClick={() => copy(address)} className="w-full flex justify-between">
      {`${address.slice(0, 6)}…${address.slice(-4)}`}
      {hasCopyButton ? <CopyIcon className="icon-sm ml-2" /> : null}
    </div>
  );
};

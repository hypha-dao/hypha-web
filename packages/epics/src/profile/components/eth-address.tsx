import { CopyIcon } from '@radix-ui/react-icons';

interface EthAdressProps {
  address?: string;
  hasCopyButton?: boolean;
}

export const EthAddress = ({ address, hasCopyButton }: EthAdressProps) => {
  const copyToClipboard = (text: string) => {
    if (hasCopyButton) {
      navigator.clipboard.writeText(text);
    }
  };

  if (!address) return null;

  return (
    <div
      onClick={() => copyToClipboard(address)}
      className="w-full flex justify-between"
    >
      {`${address.slice(0, 6)}…${address.slice(-4)}`}
      {hasCopyButton ? <CopyIcon className="icon-sm ml-2" /> : null}
    </div>
  );
};

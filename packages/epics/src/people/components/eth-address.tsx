import { CopyIcon } from '@radix-ui/react-icons';
import { copyToClipboard } from '@hypha-platform/ui-utils';

interface EthAdressProps {
  address: string;
  onClick?: (address: string) => void;
}

export const EthAddress = ({
  address,
  onClick = copyToClipboard,
}: EthAdressProps) => {
  return (
    <div
      onClick={() => onClick(address)}
      className="w-full flex justify-between items-center cursor-pointer"
    >
      <span className="text-neutral-9">
        {`${address.slice(0, 6)}…${address.slice(-4)}`}
      </span>
      <CopyIcon className="icon-sm ml-2" />
    </div>
  );
};

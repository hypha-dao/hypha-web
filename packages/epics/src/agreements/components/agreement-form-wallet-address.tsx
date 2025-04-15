import { CopyIcon } from '@radix-ui/react-icons';
import { copyToClipboard } from '@hypha-platform/lib/utils';
import { shortenAddress } from '@hypha-platform/lib/utils';

interface AgreementFormWalletAddressProps {
  address: string;
}

export const AgreementFormWalletAddress = ({
  address,
}: AgreementFormWalletAddressProps) => {
  return (
    <div className="flex w-full items-center justify-between">
      <label className="text-2 text-neutral-11">Wallet Address</label>
      <span className="flex items-center gap-2 max-w-[240px] px-2 py-1 bg-secondary border border-neutral-5 rounded-lg truncate">
        <span className="text-neutral-9 text-sm truncate">
          {shortenAddress(address)}
        </span>
        <CopyIcon
          className="cursor-pointer shrink-0"
          onClick={() => copyToClipboard(address)}
        />
      </span>
    </div>
  );
};

import { EthAddress } from '../../people/components/eth-address';

interface AgreementFormWalletAddressProps {
  address: string;
}

export const AgreementFormWalletAddress = ({
  address,
}: AgreementFormWalletAddressProps) => {
  return (
    <div className="flex w-full items-center justify-between">
      <label className="text-2 text-neutral-11">Wallet Address</label>
      <span className="flex items-center max-w-[240px] px-2 py-1 bg-secondary border border-neutral-5 rounded-lg">
        <EthAddress address={address} />
      </span>
    </div>
  );
};

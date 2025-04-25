import { Input } from '@hypha-platform/ui';

interface WalletAddressProps {
  address: string;
  onChange?: (address: string) => void;
}

export const WalletAddress = ({ address, onChange }: WalletAddressProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <div className="flex w-full items-center justify-between">
      <label className="text-2 text-neutral-11">Wallet Address</label>
      <div>
        <Input
          value={address}
          onChange={handleChange}
          className="max-w-[240px] text-2"
          placeholder="Enter wallet address"
        />
      </div>
    </div>
  );
};

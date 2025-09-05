import { Input, RequirementMark } from '@hypha-platform/ui';

interface WalletAddressProps {
  address: string;
  onChange?: (address: string) => void;
  disabled?: boolean;
}

export const WalletAddress = ({
  address,
  onChange,
  disabled = false,
}: WalletAddressProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange?.(e.target.value);
  };

  return (
    <div className="flex flex-col md:flex-row w-full md:items-center md:justify-between gap-4">
      <label className="text-2 text-neutral-11 flex flex-row gap-1">
        Wallet Address
        <RequirementMark className="text-2" />
      </label>
      <div>
        <Input
          value={address}
          onChange={handleChange}
          className="md:w-72"
          placeholder="Enter wallet address"
          disabled={disabled}
        />
      </div>
    </div>
  );
};

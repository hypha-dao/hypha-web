'use client';

interface TokenBackingVaultDetailRowProps {
  label: string;
  value: React.ReactNode;
}

export function TokenBackingVaultDetailRow({
  label,
  value,
}: TokenBackingVaultDetailRowProps) {
  return (
    <div className="flex justify-between items-center">
      <div className="text-1 text-neutral-11 w-full">{label}</div>
      <div className="text-1 text-nowrap">{value}</div>
    </div>
  );
}

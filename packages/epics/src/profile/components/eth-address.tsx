export const EthAddress = ({ address }: { address?: string }) => {
  if (!address) return null;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

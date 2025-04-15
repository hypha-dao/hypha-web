export const shortenAddress = (address: string, start = 10, end = 8) => {
  if (!address) return '';
  return address.length > start + end
    ? `${address.slice(0, start)}...${address.slice(-end)}`
    : address;
};

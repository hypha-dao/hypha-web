export const useSalesBanner = () => {
  const daysLeft = 26;
  const status: 'trial' | 'beforeExpiry' | 'expired' = 'trial';

  const onClose = () => {
    console.log('Close banner');
  };

  return { status, daysLeft, onClose };
};

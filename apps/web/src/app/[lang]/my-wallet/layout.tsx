export const metadata = {
  title: 'Hypha | My Wallet',
  description: 'View your wallet, banking, transactions, and rewards.',
};

export default async function MyWalletLayout({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full">
      {children}
      {aside}
    </div>
  );
}

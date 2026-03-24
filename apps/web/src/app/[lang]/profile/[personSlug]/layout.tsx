export default async function RootLayout({
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

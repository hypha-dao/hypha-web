export default async function RootLayout({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside: React.ReactNode;
}) {
  return (
    <div className="w-full h-full flex">
      {children}
      {aside}
    </div>
  );
}

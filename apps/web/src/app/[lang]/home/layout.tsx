export const metadata = {
  title: 'Hypha | Home',
  description: 'Your spaces, wallet, activity, and wellbeing in one place.',
};

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-full w-full">{children}</div>;
}

import { Locale } from '@hypha-platform/i18n';
import { MenuTop } from '@hypha-platform/ui/server';

export default async function DhoLayout({
  children,
  params: { id: daoSlug, lang },
}: {
  children: React.ReactNode;
  params: { id: string; lang: Locale };
}) {

  return (
    <div className="flex flex-grow w-full h-full">
      <MenuTop
        createActionHref={'/[lang]/dho/[id]/assignments/create'
          .replace('[lang]', lang)
          .replace('[id]', daoSlug)}
        navItems={[
          {
            label: 'Explore',
            href: `/${lang}/`,
          },
          {
            label: 'My Projects',
            href: `/${lang}/my-projects`,
          },
          {
            label: 'Wallet',
            href: `/${lang}/wallet`,
          },
        ]}
      />
      <div className="fixed bottom-0 right-0 flex-grow p-10 overflow-y-auto top-20 left-20 bg-background/5">
        {children}
      </div>
    </div>
  );
}
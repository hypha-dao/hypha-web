import { Logo } from '../atoms';
import { ButtonNavItem } from '../button-nav-item';

type Dao = {
  title: string;
  id: string;
};

type MenuTopNavItem = {
  label: string;
  href: string;
};

type MenuTopProps = {
  activeDao?: Dao;
  navItems: MenuTopNavItem[];
  children?: React.ReactNode;
  logoHref?: string;
};

export const MenuTop = ({
  activeDao,
  navItems,
  children,
  logoHref,
}: MenuTopProps) => {
  return (
    <header className="fixed top-0 right-0 left-0 flex items-center h-9 px-10 bg-background z-10">
      <div className="w-full max-w-[--spacing-container-2xl] mx-auto flex items-center justify-between space-x-10">
        { !!logoHref &&
          <Logo width={140} href={logoHref} />
        }
        <div id="menu-top-active-dao" className="flex-grow">
          {activeDao && <h1 className="text-2xl">{activeDao.title}</h1>}
        </div>
        <div id="menu-top-actions" className="flex justify-center gap-2">
          {navItems.map((item) => (
            <ButtonNavItem
              key={item.href}
              href={item.href}
              label={item.label}
            />
          ))}
        </div>
        {children}
      </div>
    </header>
  );
};

const RightSlot: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div id="menu-top-profile">{children}</div>
);

RightSlot.displayName = 'MenuTop.RightSlot';
MenuTop.RightSlot = RightSlot;

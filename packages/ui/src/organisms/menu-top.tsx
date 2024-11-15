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
  createActionHref?: string;
  children?: React.ReactNode;
  withLogo?: boolean;
};

export const MenuTop = ({
  activeDao,
  navItems,
  createActionHref,
  children,
  withLogo,
}: MenuTopProps) => {
  console.debug('MenuTopProps', { createActionHref });
  return (
    <div className="fixed top-0 right-0 left-0 flex items-center space-x-10 h-20 px-10 bg-background/5">
      {withLogo ? <Logo width={140}></Logo> : null}
      <div id="menu-top-active-dao" className="flex-grow">
        {activeDao && <h1 className="text-2xl">{activeDao.title}</h1>}
      </div>
      <div
        id="menu-top-actions"
        className="flex justify-center gap-2"
      >
        {navItems.map((item) => (
          <ButtonNavItem key={item.href} href={item.href} label={item.label} />
        ))}
      </div>
      {children}
    </div>
  );
};

MenuTop.RightSlot = ({ children }: { children: React.ReactNode }) => (
  <div id="menu-top-profile">
    {children}
  </div>
);

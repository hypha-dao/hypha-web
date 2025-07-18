'use client';

import { Logo } from '../atoms';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { RxCross1 } from 'react-icons/rx';
import { usePathname } from 'next/navigation';

type MenuTopProps = {
  children?: React.ReactNode;
  logoHref?: string;
};

export const MenuTop = ({ children, logoHref }: MenuTopProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="fixed top-0 right-0 left-0 flex items-center h-9 bg-page-background z-20">
      <div className="w-full mx-auto flex items-center justify-between px-10">
        {!!logoHref && <Logo width={140} href={logoHref} />}

        {/* Desktop Nav */}
        <div id="menu-top-actions" className="hidden md:flex gap-2">
          {children}
        </div>

        {/* Mobile Burger */}
        <button
          className="md:hidden flex items-center"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-menu"
          onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
        >
          {!isMobileMenuOpen && <Menu className="size-5" />}
          {isMobileMenuOpen && <RxCross1 className="size-5" />}
        </button>

        {/* Mobile Full Screen Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-9 z-40 flex flex-col items-center px-5 py-4 bg-page-background overflow-y-auto">
            <div className="flex flex-col space-y-8 items-center">
              {children}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

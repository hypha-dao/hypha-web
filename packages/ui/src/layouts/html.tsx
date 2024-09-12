import clsx from 'clsx';
import { Lato, Source_Sans_3 } from 'next/font/google';

const lato = Lato({
  subsets: ['latin'],
  display: 'swap',
  weight: ['900', '700', '400', '300'],
  variable: '--font-heading',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
  weight: ['900', '700', '400', '300'],
  variable: '--font-body',
});

export const Html: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <html lang="en" className={clsx(lato.variable, sourceSans.variable)}>
      <body className="flex w-full h-full">{children}</body>
    </html>
  );
};
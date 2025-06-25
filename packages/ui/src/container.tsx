import clsx from 'clsx';

type Props = {
  children?: React.ReactNode;
  className?: string;
};

export const Container = ({ children, className }: Props) => {
  // Tailwind doesn't have a native way to say:
  // "Use screen breakpoint 2xl (1536px), but apply a container max-width of 1100px."
  // So we need to use custom classes for this.
  return <div className={clsx(
    'container mx-auto',
    'max-w-[64rem] md:max-w-[76rem] lg:max-w-[81.2rem] 2xl:max-w-[110rem]',
    className
  )}>{children}</div>;
};
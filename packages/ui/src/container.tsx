import clsx from 'clsx';

type Props = {
  children?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export const Container = ({ children, size = 'md', className }: Props) => {
  // Tailwind doesn't have a native way to say:
  // "Use screen breakpoint 2xl (1536px), but apply a container max-width of 1100px."
  // So we need to use custom classes for this.
  return (
    <div
      className={clsx(
        'mx-auto px-5',
        'max-w-container-sm md:max-w-container-md',
        size == 'md' && 'lg:max-w-container-lg xl:max-w-container-xl',
        size == 'lg' && 'lg:max-w-container-xl xl:max-w-container-2xl',
        className,
      )}
    >
      {children}
    </div>
  );
};

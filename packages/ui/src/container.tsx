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
        'container mx-auto px-5',
        'max-w-spacing-container-sm md:max-w-spacing-container-md',
        size == 'md' &&
          'lg:max-w-spacing-container-lg xl:max-w-spacing-container-xl',
        size == 'lg' &&
          'lg:max-w-spacing-container-xl xl:max-w-spacing-container-2xl',
        className,
      )}
    >
      {children}
    </div>
  );
};

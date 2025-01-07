import clsx from 'clsx';

type Props = {
  children?: React.ReactNode;
  className?: string;
};

export const Container = ({ children, className }: Props) => {
  return (
    <div className={clsx('container mx-auto px-10', className)}>{children}</div>
  );
};

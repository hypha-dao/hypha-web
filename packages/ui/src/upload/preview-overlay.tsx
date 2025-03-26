import clsx from 'clsx';
import React from 'react';

export const PreviewOverlay = ({
  children,
  isVisible,
}: {
  isVisible: boolean;
  children: React.ReactElement;
}) => {
  return (
    <div
      className={clsx(
        'absolute flex items-center justify-center',
        'p-2 rounded transition-all duration-200',
        'group-hover:bg-background/100',
        'group-hover:opacity-100',
        isVisible ? 'opacity-100 bg-background/20' : 'opacity-0',
      )}
    >
      {children}
    </div>
  );
};

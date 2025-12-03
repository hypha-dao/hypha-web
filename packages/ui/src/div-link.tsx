'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

interface DivLinkProps extends React.ComponentProps<'div'> {
  href?: string;
}

const DivLink = React.forwardRef<HTMLDivElement, DivLinkProps>(
  ({ className, children, href, 'aria-label': ariaLabel, ...props }, ref) => {
    const router = useRouter();
    return (
      <div
        ref={ref}
        className="cursor-pointer"
        role="link"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={() => {
          if (href) {
            router.push(href);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (href) {
              router.push(href);
            }
          }
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);
DivLink.displayName = 'DivLink';

export { DivLink };

import * as React from 'react';
import { cn } from '@hypha-platform/ui-utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Classes for the outer wrapper. Use for headline inputs that need h-auto and min-h larger than the default. */
  rootClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, rootClassName, ...props }, ref) => {
    const isSearchInput = type === 'search';
    // Checkboxes/radios must not inherit the text-input `w-full` wrapper —
    // that expands between the control and its label in flex rows and crushes
    // multi-word labels into one-word-per-line columns.
    const isCheckable = type === 'checkbox' || type === 'radio';

    return (
      <div
        className={cn(
          'relative flex items-center',
          isCheckable ? 'h-auto min-h-0 w-auto shrink-0' : 'min-h-10 w-full',
          rootClassName,
        )}
      >
        {leftIcon && (
          <div
            className={cn(
              'absolute left-2 flex items-center pointer-events-none text-muted-foreground',
              isSearchInput && 'text-foreground',
            )}
          >
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            isCheckable
              ? 'disabled:cursor-not-allowed disabled:opacity-50'
              : [
                  'flex h-10 min-h-10 w-full rounded-none border border-border bg-neutral-1 px-3 py-2 text-2 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus:outline-none focus-visible:border-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  'placeholder:text-muted-foreground placeholder:text-2 placeholder:text-medium',
                ],
            !isCheckable &&
              isSearchInput &&
              'text-foreground caret-foreground placeholder:text-muted-foreground',
            !isCheckable && leftIcon && 'pl-12',
            !isCheckable && rightIcon && 'pr-12',
            className,
          )}
          ref={ref}
          {...props}
        />
        {rightIcon && (
          <div
            className={cn(
              'absolute right-2 flex items-center pointer-events-none text-muted-foreground',
              isSearchInput && 'text-foreground',
            )}
          >
            {rightIcon}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };

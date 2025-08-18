import * as React from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { ChangeEventHandler } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, leftIcon, rightIcon, value, onChange, ...props },
    ref,
  ) => {
    const [inputValue, setInputValue] = React.useState<string>(value ?? '');
    React.useEffect(() => {
      if (inputValue !== value) {
        setInputValue(value ?? '');
      }
    }, [value]);
    return (
      <div className="relative flex items-center h-6 w-full">
        {leftIcon && (
          <div className="absolute left-2 flex items-center pointer-events-none text-muted-foreground">
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-6 w-full rounded border border-input bg-neutral-1 px-3 py-2 text-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            'placeholder:text-muted-foreground placeholder:text-2 placeholder:text-medium',
            leftIcon && 'pl-12',
            rightIcon && 'pr-12',
            className,
          )}
          ref={ref}
          value={inputValue}
          onChange={(e) => {
            e.stopPropagation();
            onChange?.(e);
            setInputValue(e.target.value);
          }}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-2 flex items-center pointer-events-none text-muted-foreground">
            {rightIcon}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };

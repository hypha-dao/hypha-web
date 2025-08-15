'use client';

import { cn } from '@hypha-platform/ui-utils';
import React from 'react';
import { Button } from './button';
import { Cross2Icon } from '@radix-ui/react-icons';
import { v4 as uuidv4 } from 'uuid';

type ErrorAlertLabelElement = HTMLDivElement;
interface ErrorAlertLabelProps
  extends React.HTMLAttributes<ErrorAlertLabelElement> {
  text: string;
  onClose: () => void;
}

const ErrorAlertLabel = React.forwardRef<
  ErrorAlertLabelElement,
  ErrorAlertLabelProps
>(({ className, text, onClose, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('opacity-100 text-white bg-red-500 rounded-full', className)}
    {...props}
  >
    <p className="inline-flex mb-2 mt-2 ml-4">{text}</p>
    <Button
      className="ml-2 rounded-lg bg-transparent hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      onClick={onClose}
      colorVariant="neutral"
      variant="ghost"
      aria-label="Close"
    >
      <Cross2Icon />
    </Button>
  </div>
));
ErrorAlertLabel.displayName = 'ErrorAlertLabel';

type ErrorAlertElement = HTMLDivElement;
interface ErrorAlertProps extends React.HTMLAttributes<ErrorAlertElement> {
  lines: string[];
}

function removeLine(lines: string[], index: number) {
  return lines.filter((_, i) => index !== i);
}

const ErrorAlert = React.forwardRef<ErrorAlertElement, ErrorAlertProps>(
  ({ className, lines, ...props }, ref) => {
    const [errorLines, setErrorLines] = React.useState<string[]>(lines);

    React.useEffect(() => {
      setErrorLines(lines);
    }, [lines]);

    return (
      <div
        ref={ref}
        className={cn('fixed right-5 bottom-5 bg-transparent z-50', className)}
        {...props}
      >
        {errorLines.map((line, index) => (
          <ErrorAlertLabel
            key={`error-${index}-${line}`}
            text={line}
            onClose={() => {
              setErrorLines(removeLine(errorLines, index));
            }}
          />
        ))}
      </div>
    );
  },
);
ErrorAlert.displayName = 'ErrorAlert';

export { ErrorAlert, ErrorAlertLabel };

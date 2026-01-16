import { FC } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../alert-dialog';
import React from 'react';
import { Button } from '../button';

export type ConfirmDialogProps = {
  triggerText?: string;
  title: string;
  description: string;
  customAcceptButtonText?: string;
  customRejectButtonText?: string;
  onAcceptClicked?: () => void | Promise<void>;
  onRejectClicked?: () => void;
  children?: React.ReactNode;
  isLoading?: boolean;
};

export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  triggerText,
  title,
  description,
  customAcceptButtonText,
  customRejectButtonText,
  onAcceptClicked,
  onRejectClicked,
  children,
  isLoading = false,
}) => {
  const [open, setOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleAccept = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (onAcceptClicked && !isProcessing) {
      setIsProcessing(true);
      try {
        await onAcceptClicked();
        if (!isLoading) {
          setOpen(false);
        }
      } finally {
        setIsProcessing(false);
      }
    }
  };

  React.useEffect(() => {
    if (!isLoading && isProcessing) {
      setOpen(false);
      setIsProcessing(false);
    }
  }, [isLoading, isProcessing]);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!isProcessing && !isLoading) {
          setOpen(newOpen);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        {children ? (
          children
        ) : (
          <Button variant="outline" colorVariant="neutral">
            {triggerText ?? 'Open'}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogTitle className="m-0 text-[17px] font-medium text-mauve12 text-card-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          <div className="flex justify-end gap-[25px]">
            <AlertDialogCancel asChild>
              <Button
                variant="outline"
                colorVariant="neutral"
                onClick={onRejectClicked}
                disabled={isProcessing || isLoading}
              >
                {customRejectButtonText ?? 'Cancel'}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="outline"
                colorVariant="neutral"
                onClick={handleAccept}
                disabled={isProcessing || isLoading}
              >
                {isProcessing || isLoading
                  ? 'Processing...'
                  : customAcceptButtonText ?? 'OK'}
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
};

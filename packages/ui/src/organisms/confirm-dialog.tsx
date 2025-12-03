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
  onAcceptClicked?: () => void;
  onRejectClicked?: () => void;
  children?: React.ReactNode;
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
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
              >
                {customRejectButtonText ?? 'Cancel'}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="outline"
                colorVariant="neutral"
                onClick={onAcceptClicked}
              >
                {customAcceptButtonText ?? 'OK'}
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
};

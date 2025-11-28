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
          <Button className="inline-flex h-[35px] items-center justify-center rounded bg-violet4 px-[15px] font-medium leading-none text-violet11 outline-none outline-offset-1 hover:bg-mauve3 focus-visible:outline-2 focus-visible:outline-violet6 select-none">
            {triggerText ?? 'Open'}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogPortal>
        <AlertDialogOverlay className="fixed inset-0 bg-blackA6 data-[state=open]:animate-overlayShow" />
        <AlertDialogContent className="fixed border left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded bg-gray1 bg-card text-card-foreground p-[25px] shadow-[var(--shadow-6)] focus:outline-none data-[state=open]:animate-contentShow">
          <AlertDialogTitle className="m-0 text-[17px] font-medium text-mauve12 text-card-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="mb-5 mt-[15px] text-[15px] leading-normal text-mauve11 text-card-foreground">
            {description}
          </AlertDialogDescription>
          <div className="flex justify-end gap-[25px]">
            <AlertDialogCancel asChild>
              <Button
                variant="outline"
                colorVariant="neutral"
                className="inline-flex h-[35px] items-center justify-center rounded bg-neutral-4 px-[15px] font-medium leading-none text-neutral-11 outline-none hover:bg-neutral-5 outline-offset-1 focus-visible:outline-2 focus-visible:outline-neutral-7 select-none"
                onClick={onRejectClicked}
              >
                {customRejectButtonText ? customRejectButtonText : <>Cancel</>}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="outline"
                colorVariant="neutral"
                className="inline-flex h-[35px] items-center justify-center rounded bg-accent-4 px-[15px] font-medium leading-none text-accent-11 outline-none outline-offset-1  hover:bg-accent-5 focus-visible:outline-2 focus-visible:outline-accent-5 select-none"
                onClick={onAcceptClicked}
              >
                {customAcceptButtonText ? customAcceptButtonText : <>OK</>}
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
};

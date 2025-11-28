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
  triggerText: string;
  title: string;
  description: string;
  customAcceptButtonText?: string;
  customRejectButtonText?: string;
  onAcceptClicked?: () => void;
  onRejectClicked?: () => void;
};

export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  triggerText,
  title,
  description,
  customAcceptButtonText,
  customRejectButtonText,
  onAcceptClicked,
  onRejectClicked,
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button className="inline-flex h-[35px] items-center justify-center rounded bg-violet4 px-[15px] font-medium leading-none text-violet11 outline-none outline-offset-1 hover:bg-mauve3 focus-visible:outline-2 focus-visible:outline-violet6 select-none">
          {triggerText}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogPortal>
        <AlertDialogOverlay className="fixed inset-0 bg-blackA6 data-[state=open]:animate-overlayShow" />
        <AlertDialogContent className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-md bg-gray1 p-[25px] shadow-[var(--shadow-6)] focus:outline-none data-[state=open]:animate-contentShow">
          <AlertDialogTitle className="m-0 text-[17px] font-medium text-mauve12">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="mb-5 mt-[15px] text-[15px] leading-normal text-mauve11">
            {description}
          </AlertDialogDescription>
          <div className="flex justify-end gap-[25px]">
            <AlertDialogCancel asChild>
              <Button
                className="inline-flex h-[35px] items-center justify-center rounded bg-mauve4 px-[15px] font-medium leading-none text-mauve11 outline-none outline-offset-1 hover:bg-mauve5 focus-visible:outline-2 focus-visible:outline-mauve7 select-none"
                onClick={onRejectClicked}
              >
                {customRejectButtonText ? customRejectButtonText : <>Cancel</>}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                className="inline-flex h-[35px] items-center justify-center rounded bg-red4 px-[15px] font-medium leading-none text-red11 outline-none outline-offset-1 hover:bg-red5 focus-visible:outline-2 focus-visible:outline-red7 select-none"
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

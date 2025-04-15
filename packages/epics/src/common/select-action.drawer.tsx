'use client';

import { useMediaQuery } from '@hypha-platform/lib/utils';
import {
  ScrollArea,
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@hypha-platform/ui';
import { SelectAction, SelectActionProps } from './select-action';

type SelectActionDrawerProps = {
  trigger: React.ReactElement;
} & SelectActionProps;

export const SelectActionDrawer = (props: SelectActionDrawerProps) => {
  const isDesktop = useMediaQuery('(min-width: 641px)');

  return (
    <Sheet>
      <SheetTrigger>{props.trigger}</SheetTrigger>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className="container-lg"
      >
        {/* TODO: figure out why ScrollArea component doesn't work */}
        <div className="h-full overflow-scroll">
          <SelectAction {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

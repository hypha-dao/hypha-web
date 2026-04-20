'use client';

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

const SlotContext = createContext<ReactNode | null>(null);
const SetterContext = createContext<Dispatch<
  SetStateAction<ReactNode | null>
> | null>(null);

export function MenuBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ReactNode | null>(null);
  return (
    <SetterContext.Provider value={setSlot}>
      <SlotContext.Provider value={slot}>{children}</SlotContext.Provider>
    </SetterContext.Provider>
  );
}

export function useMenuBreadcrumbSlot(): ReactNode | null {
  return useContext(SlotContext);
}

export function useSetMenuBreadcrumb(): Dispatch<
  SetStateAction<ReactNode | null>
> {
  const fn = useContext(SetterContext);
  if (!fn) {
    throw new Error(
      'useSetMenuBreadcrumb must be used within MenuBreadcrumbProvider',
    );
  }
  return fn;
}

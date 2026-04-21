import type { ReactElement } from 'react';
import {
  LoadingBackdropInner,
  type LoadingBackdropInnerProps,
} from './loading-backdrop-inner';

/** `Omit` on a union is not distributive; use this so `showKeepWindowOpenMessage` + `keepWindowOpenMessage` types flow through. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type LoadingBackdropProps = DistributiveOmit<
  LoadingBackdropInnerProps,
  'children'
> & {
  children: ReactElement;
};

/**
 * Loading overlay for forms. Modal-shell mode: portaled full-viewport scrim with
 * blur + compact status chip (no heavy white card). Docked / inline: legacy card.
 */
export function LoadingBackdrop(props: LoadingBackdropProps) {
  return <LoadingBackdropInner {...props} />;
}

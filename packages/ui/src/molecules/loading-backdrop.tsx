import type { ReactElement } from 'react';
import {
  LoadingBackdropInner,
  type LoadingBackdropInnerProps,
} from './loading-backdrop-inner';

type LoadingBackdropProps = Omit<LoadingBackdropInnerProps, 'children'> & {
  children: ReactElement;
};

/**
 * Loading overlay for forms. Modal-shell mode: portaled full-viewport scrim with
 * blur + compact status chip (no heavy white card). Docked / inline: legacy card.
 */
export function LoadingBackdrop(props: LoadingBackdropProps) {
  return <LoadingBackdropInner {...props} />;
}

import type { ReactElement } from 'react';
import {
  LoadingBackdropInner,
  type LoadingBackdropInnerProps,
} from './loading-backdrop-inner';

type LoadingBackdropProps = Omit<LoadingBackdropInnerProps, 'children'> & {
  children: ReactElement;
};

/**
 * Loading overlay for forms. When rendered inside {@link AsideOverlayLayoutProvider}
 * (`ProposalOverlayShell`), full-height loading follows the responsive modal shell
 * so it covers the centered modal instead of the legacy fixed side-panel strip.
 */
export function LoadingBackdrop(props: LoadingBackdropProps) {
  return <LoadingBackdropInner {...props} />;
}

import type { ReactElement } from 'react';
import {
  LoadingBackdropInner,
  type LoadingBackdropInnerProps,
} from './loading-backdrop-inner';

type LoadingBackdropProps = Omit<LoadingBackdropInnerProps, 'children'> & {
  children: ReactElement;
};

/**
 * Loading overlay for forms. In modal-shell layout, the overlay is portaled to
 * `document.body` with `fixed inset-0` so it stays visible while long forms scroll
 * inside the modal card (not clipped by `overflow-y-auto`).
 */
export function LoadingBackdrop(props: LoadingBackdropProps) {
  return <LoadingBackdropInner {...props} />;
}

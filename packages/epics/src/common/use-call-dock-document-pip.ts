'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';

type DocumentPictureInPicture = {
  requestWindow: (options: {
    width: number;
    height: number;
  }) => Promise<Window>;
  window: Window | null;
};

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

function copyStylesIntoWindow(target: Window) {
  for (const sheet of document.styleSheets) {
    try {
      if (sheet.href) {
        const link = target.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.document.head.appendChild(link);
        continue;
      }
      const owner = sheet.ownerNode;
      if (owner instanceof HTMLElement) {
        target.document.head.appendChild(owner.cloneNode(true));
      }
    } catch {
      if (sheet.href) {
        const link = target.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
}

/**
 * Chrome/Edge Document Picture-in-Picture — keeps the call dock visible when
 * the user switches to another browser tab (Zoom-style floating window).
 */
export function useCallDockDocumentPip(dockRef: RefObject<HTMLElement | null>) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
        typeof window.documentPictureInPicture?.requestWindow === 'function',
    );
  }, []);

  useEffect(() => {
    if (!pipWindow) return;
    const onPageHide = () => setPipWindow(null);
    pipWindow.addEventListener('pagehide', onPageHide);
    return () => pipWindow.removeEventListener('pagehide', onPageHide);
  }, [pipWindow]);

  const openPip = useCallback(async () => {
    const api = window.documentPictureInPicture;
    if (!api?.requestWindow) return false;
    if (pipWindow) return true;

    const el = dockRef.current;
    const width = Math.max(360, el?.offsetWidth ?? 480);
    const height = Math.max(260, el?.offsetHeight ?? 320);
    const win = await api.requestWindow({ width, height });
    copyStylesIntoWindow(win);
    win.document.documentElement.style.height = '100%';
    win.document.body.style.margin = '0';
    win.document.body.style.height = '100%';
    win.document.body.style.background = 'transparent';
    win.document.body.style.overflow = 'hidden';
    setPipWindow(win);
    return true;
  }, [dockRef, pipWindow]);

  const closePip = useCallback(() => {
    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
    }
    setPipWindow(null);
  }, [pipWindow]);

  return {
    pipWindow,
    isSupported,
    isOpen: Boolean(pipWindow),
    openPip,
    closePip,
  };
}

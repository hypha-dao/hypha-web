'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';

import {
  clampCallDocumentPipWindowSize,
  type CallDocumentPipWindowMode,
  type CallDocumentPipWindowSize,
} from './human-chat-panel/call-document-pip-window-geometry';

type DocumentPictureInPicture = {
  requestWindow: (options: {
    width: number;
    height: number;
    preferInitialWindowPlacement?: boolean;
  }) => Promise<Window>;
  window: Window | null;
};

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export type CallDockPipWindowSize = CallDocumentPipWindowSize;

function clampPipWindowSize(
  size: CallDockPipWindowSize,
  mode: CallDocumentPipWindowMode,
): CallDockPipWindowSize {
  return clampCallDocumentPipWindowSize(size, mode);
}

function readPipWindowSize(pipWindow: Window): CallDockPipWindowSize {
  return {
    width: pipWindow.innerWidth,
    height: pipWindow.innerHeight,
  };
}

function applyPipWindowSize(
  pipWindow: Window,
  size: CallDockPipWindowSize,
  mode: CallDocumentPipWindowMode,
): CallDockPipWindowSize {
  const clamped = clampPipWindowSize(size, mode);
  const current = readPipWindowSize(pipWindow);
  if (
    Math.abs(clamped.width - current.width) <= 1 &&
    Math.abs(clamped.height - current.height) <= 1
  ) {
    return clamped;
  }
  try {
    pipWindow.resizeTo(clamped.width, clamped.height);
  } catch {
    // resizeTo is best-effort for Document PiP windows.
  }
  return clamped;
}

/** Mirror theme tokens and typography so portaled dock matches the main app. */
export function copyCallDocumentPipAppearance(
  source: Document,
  target: Document,
) {
  copyDocumentAppearance(source, target);
}

function copyDocumentAppearance(source: Document, target: Document) {
  const sourceHtml = source.documentElement;
  const targetHtml = target.documentElement;
  targetHtml.className = sourceHtml.className;
  targetHtml.lang = sourceHtml.lang;
  for (const attr of sourceHtml.attributes) {
    if (attr.name === 'class' || attr.name === 'lang') continue;
    targetHtml.setAttribute(attr.name, attr.value);
  }

  const rootComputed = getComputedStyle(sourceHtml);
  for (let i = 0; i < rootComputed.length; i += 1) {
    const prop = rootComputed.item(i);
    if (!prop?.startsWith('--')) continue;
    targetHtml.style.setProperty(prop, rootComputed.getPropertyValue(prop));
  }
  const colorScheme = rootComputed.colorScheme;
  if (colorScheme) {
    targetHtml.style.colorScheme = colorScheme;
  }

  target.body.className = source.body.className;
  const bodyComputed = getComputedStyle(source.body);
  target.body.style.fontFamily = bodyComputed.fontFamily;
  target.body.style.fontSize = bodyComputed.fontSize;
  target.body.style.lineHeight = bodyComputed.lineHeight;
  target.body.style.background = 'transparent';
  target.body.style.margin = '0';
  target.body.style.height = '100%';
  target.body.style.overflow = 'hidden';
  target.body.style.userSelect = 'none';
  targetHtml.style.height = '100%';
  targetHtml.style.userSelect = 'none';
}

function copyStylesIntoWindow(target: Window) {
  copyDocumentAppearance(document, target.document);

  const seenHrefs = new Set<string>();
  for (const node of document.head.querySelectorAll(
    'link[rel="stylesheet"], style',
  )) {
    if (node instanceof HTMLLinkElement && node.href) {
      if (seenHrefs.has(node.href)) continue;
      seenHrefs.add(node.href);
    }
    target.document.head.appendChild(node.cloneNode(true));
  }

  for (const sheet of document.styleSheets) {
    try {
      if (sheet.href) {
        if (seenHrefs.has(sheet.href)) continue;
        seenHrefs.add(sheet.href);
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
      if (sheet.href && !seenHrefs.has(sheet.href)) {
        seenHrefs.add(sheet.href);
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
 *
 * The in-page call dock is already draggable/floating; this API creates a
 * separate always-on-top browser window because a fixed in-tab overlay is
 * hidden when the Hypha tab is in the background.
 */
export function useCallDockDocumentPip(
  dockRef: RefObject<HTMLElement | null>,
  windowSize: CallDockPipWindowSize,
  windowMode: CallDocumentPipWindowMode = 'call',
) {
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

  useEffect(() => {
    if (!pipWindow) return;
    applyPipWindowSize(pipWindow, windowSize, windowMode);
  }, [pipWindow, windowMode, windowSize.height, windowSize.width]);

  const openPip = useCallback(async () => {
    const api = window.documentPictureInPicture;
    if (!api?.requestWindow) return false;
    if (pipWindow) return true;

    const initialSize = clampPipWindowSize(windowSize, windowMode);
    const win = await api.requestWindow({
      width: initialSize.width,
      height: initialSize.height,
      preferInitialWindowPlacement: true,
    });
    copyStylesIntoWindow(win);
    applyPipWindowSize(win, initialSize, windowMode);
    setPipWindow(win);
    return true;
  }, [pipWindow, windowMode, windowSize.height, windowSize.width]);

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

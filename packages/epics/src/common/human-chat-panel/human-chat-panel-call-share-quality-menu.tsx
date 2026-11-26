'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Check, Gauge } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@hypha-platform/ui-utils';

import { useShareQualityPicker } from './call-share-quality-store';

/**
 * Receive-quality picker for a remote screenshare (#2742), in the call toolbar so it can be used in
 * the dock, the full view and the Document PiP alike. Renders nothing unless a remote share tile
 * has published its options.
 */
export function HumanChatPanelCallShareQualityMenu({
  triggerClassName,
  iconClassName,
  iconStrokeWidth,
  pip = false,
  dark = false,
}: {
  triggerClassName?: string;
  iconClassName?: string;
  iconStrokeWidth?: number;
  /** Document PiP density: the popover is fixed above the toolbar. */
  pip?: boolean;
  /** Full view (dark toolbar). */
  dark?: boolean;
}) {
  const t = useTranslations('HumanChatPanel');
  const picker = useShareQualityPicker();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const menuItems = (): HTMLButtonElement[] =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]:not(:disabled)',
      ) ?? [],
    );

  // Menu-button pattern: focus moves into the menu on open (the checked item, else the first).
  useEffect(() => {
    if (!open) return;
    const items = menuItems();
    const checked = items.find(
      (item) => item.getAttribute('aria-checked') === 'true',
    );
    (checked ?? items[0])?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const doc = rootRef.current?.ownerDocument;
    if (!doc) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndFocusTrigger();
    };
    doc.addEventListener('pointerdown', onPointerDown);
    doc.addEventListener('keydown', onKeyDown);
    return () => {
      doc.removeEventListener('pointerdown', onPointerDown);
      doc.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    const items = menuItems();
    if (items.length === 0) return;
    const index = items.findIndex(
      (item) => item === item.ownerDocument.activeElement,
    );
    let next: number | undefined;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp')
      next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    items[next]?.focus();
  };

  useEffect(() => {
    if (!picker) setOpen(false);
  }, [picker]);

  if (!picker || picker.options.length < 2) return null;

  const selected = picker.options.find((o) => o.id === picker.selectedId);
  const currentLabel =
    selected?.kind === 'layer' ? selected.label : t('callShareQualityAuto');

  return (
    <div className="relative" ref={rootRef} data-call-interactive="true">
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        title={`${t('callShareQualityPicker')}: ${currentLabel}`}
        aria-label={`${t('callShareQualityPicker')}: ${currentLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Gauge className={iconClassName} strokeWidth={iconStrokeWidth} />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t('callShareQualityPicker')}
          onKeyDown={onMenuKeyDown}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            'z-[70] rounded-xl border bg-popover px-2 py-2 text-popover-foreground shadow-xl',
            pip
              ? 'fixed bottom-14 left-1/2 w-[calc(100dvw-1rem)] max-w-52 -translate-x-1/2'
              : 'absolute bottom-full left-1/2 mb-2 min-w-48 -translate-x-1/2',
            dark && 'border-zinc-700 bg-zinc-900 text-white',
          )}
        >
          <p className="px-2 py-1.5 text-sm font-semibold">
            {t('callShareQualityPicker')}
          </p>
          {picker.options.map((option) => {
            const disabled = option.kind === 'layer' && option.needsResize;
            const isSelected = option.id === picker.selectedId;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => {
                  picker.select(option);
                  closeAndFocusTrigger();
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {option.kind === 'auto'
                    ? t('callShareQualityAuto')
                    : option.label}
                  {disabled ? (
                    <span className="ml-1 text-xs opacity-80">
                      · {t('callShareQualityNeedsResize')}
                    </span>
                  ) : null}
                </span>
                {isSelected ? <Check className="h-4 w-4" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

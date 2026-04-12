'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

import { getEmojiMartI18n } from './emoji-mart-i18n';

export type HumanChatPanelEmojiMartBodyProps = {
  onEmojiSelect: (native: string) => void;
  /** Narrower width / height for nested menus (search may clip slightly). */
  compact?: boolean;
};

/**
 * Shared emoji-mart surface (same as inside {@link HumanChatPanelEmojiPicker})
 * for reuse in dropdown submenus without a second Popover.
 */
export function HumanChatPanelEmojiMartBody({
  onEmojiSelect,
  compact = false,
}: HumanChatPanelEmojiMartBodyProps) {
  const t = useTranslations('HumanChatPanel');
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pickerLocale = ['en', 'es', 'fr', 'de', 'pt'].includes(locale)
    ? locale
    : 'en';

  const pickerTheme = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  const outerClass = compact
    ? 'max-h-[min(300px,48vh)] w-[min(100vw-2rem,268px)] min-h-[180px] overflow-hidden'
    : 'max-h-[min(420px,70vh)] w-[min(100vw-2rem,352px)] min-h-[230px] overflow-hidden';

  if (!mounted) {
    return (
      <div
        className={
          compact
            ? 'flex h-36 w-[min(100vw-2rem,268px)] items-center justify-center text-[11px] text-muted-foreground'
            : 'flex h-40 w-[min(100vw-2rem,352px)] items-center justify-center text-xs text-muted-foreground'
        }
      >
        {t('loading')}
      </div>
    );
  }

  return (
    <div className={outerClass}>
      <Picker
        data={data}
        i18n={getEmojiMartI18n(pickerLocale)}
        onEmojiSelect={(emoji: { native: string }) => {
          onEmojiSelect(emoji.native);
        }}
        theme={pickerTheme}
        previewPosition="none"
        skinTonePosition="search"
        locale={pickerLocale}
      />
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { LayoutTemplate } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import {
  type CallFullViewLayoutMode,
  parseCallFullViewLayoutMode,
} from './call-full-view-layout';

type HumanChatPanelCallFullViewLayoutMenuProps = {
  value: CallFullViewLayoutMode;
  onValueChange: (v: CallFullViewLayoutMode) => void;
  className?: string;
};

const MODES: CallFullViewLayoutMode[] = [
  'filmstrip',
  'sideBySide',
  'speakerTop',
  'pip',
];

const LABEL_BY_MODE: Record<
  CallFullViewLayoutMode,
  `callLayout${'Filmstrip' | 'SideBySide' | 'SpeakerOnTop' | 'Pip'}`
> = {
  filmstrip: 'callLayoutFilmstrip',
  sideBySide: 'callLayoutSideBySide',
  speakerTop: 'callLayoutSpeakerOnTop',
  pip: 'callLayoutPip',
};

export function HumanChatPanelCallFullViewLayoutMenu({
  value,
  onValueChange,
  className,
}: HumanChatPanelCallFullViewLayoutMenuProps) {
  const t = useTranslations('HumanChatPanel');

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-border/50 bg-zinc-900/80 text-xs text-foreground hover:bg-zinc-800"
            title={t('callLayoutMode')}
            aria-label={t('callLayoutMode')}
          >
            <LayoutTemplate
              className="h-3.5 w-3.5 shrink-0 text-white"
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="hidden min-w-0 sm:inline sm:max-w-[10rem] sm:truncate">
              {t(LABEL_BY_MODE[value])}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(v) =>
              onValueChange(parseCallFullViewLayoutMode(String(v)))
            }
          >
            {MODES.map((m) => (
              <DropdownMenuRadioItem key={m} value={m}>
                {t(LABEL_BY_MODE[m])}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import {
  Columns2,
  GalleryHorizontal,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
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
];

const LABEL_BY_MODE: Record<
  CallFullViewLayoutMode,
  `callLayout${'Filmstrip' | 'SideBySide' | 'SpeakerOnTop'}`
> = {
  filmstrip: 'callLayoutFilmstrip',
  sideBySide: 'callLayoutSideBySide',
  speakerTop: 'callLayoutSpeakerOnTop',
};

const ICON_BY_MODE: Record<CallFullViewLayoutMode, LucideIcon> = {
  filmstrip: GalleryHorizontal,
  sideBySide: Columns2,
  speakerTop: LayoutDashboard,
};

export function HumanChatPanelCallFullViewLayoutMenu({
  value,
  onValueChange,
  className,
}: HumanChatPanelCallFullViewLayoutMenuProps) {
  const t = useTranslations('HumanChatPanel');
  const ActiveIcon = ICON_BY_MODE[value];

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-7 w-7 shrink-0 border-border/60 bg-background hover:bg-muted"
            title={t('callLayoutMode')}
            aria-label={`${t('callLayoutMode')}: ${t(LABEL_BY_MODE[value])}`}
          >
            <ActiveIcon className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(v) =>
              onValueChange(parseCallFullViewLayoutMode(String(v)))
            }
          >
            {MODES.map((mode) => {
              const ModeIcon = ICON_BY_MODE[mode];
              return (
                <DropdownMenuRadioItem key={mode} value={mode}>
                  <span className="inline-flex items-center gap-2">
                    <ModeIcon className="h-4 w-4 shrink-0" aria-hidden />
                    {t(LABEL_BY_MODE[mode])}
                  </span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

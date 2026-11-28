'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import {
  proposalPathFromSignal,
  questPathFromSignal,
  writeProposalFromSignal,
  writeQuestFromSignal,
  type SignalConvertSource,
} from '../lib/signal-convert';

const TRIGGER_CLASS =
  'box-border inline-flex h-[36px] min-h-[36px] shrink-0 items-center gap-1.5 border border-border bg-transparent px-3 text-[11px] font-semibold uppercase leading-none tracking-[0.12em] text-foreground hover:bg-foreground/5';

const ITEM_CLASS =
  'rounded-none text-[11px] font-semibold uppercase tracking-[0.12em]';

export function SignalConvertMenu({
  lang,
  spaceSlug,
  source,
}: {
  lang: string;
  spaceSlug: string;
  source: SignalConvertSource;
}) {
  const t = useTranslations('CoherenceTab');
  const router = useRouter();
  const [storageError, setStorageError] = React.useState<string | null>(null);

  const convert = (kind: 'quest' | 'proposal') => {
    if (typeof window === 'undefined') return;
    setStorageError(null);
    try {
      if (kind === 'quest') {
        writeQuestFromSignal(window.sessionStorage, spaceSlug, source);
        router.push(questPathFromSignal(lang, spaceSlug));
        return;
      }
      writeProposalFromSignal(window.sessionStorage, source);
      router.push(proposalPathFromSignal(lang, spaceSlug));
    } catch {
      setStorageError(t('signalConvertStorageError'));
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="signal-convert"
            className={TRIGGER_CLASS}
          >
            {t('signalConvert')}
            <ChevronDown className="size-3.5 shrink-0" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="min-w-36 rounded-none border border-border bg-background p-1 text-foreground shadow-none"
        >
          <DropdownMenuItem
            className={ITEM_CLASS}
            data-testid="signal-convert-quest"
            onSelect={() => convert('quest')}
          >
            {t('signalConvertQuest')}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={ITEM_CLASS}
            data-testid="signal-convert-proposal"
            onSelect={() => convert('proposal')}
          >
            {t('signalConvertProposal')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {storageError ? (
        <p role="alert" className="text-1 text-error-11">
          {storageError}
        </p>
      ) : null}
    </div>
  );
}

'use client';

import { FC, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  MarkdownSuspense,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { SPACE_INTELLIGENCE_PACKS_SWR_KEY } from '../hooks/use-space-intelligence';

export type IntelligencePackPreview = {
  id: string;
  title: string;
  description: string;
  version: number;
  template_count: number;
  templates: Array<{
    id: string;
    type: string;
    title: string;
    pack_alias: string;
    tags: string[];
    body: string;
    activated?: boolean;
  }>;
};

type PacksResponse = {
  enabled_packs?: string[];
  available?: IntelligencePackPreview[];
};

type PackTemplate = IntelligencePackPreview['templates'][number];

type SpaceIntelligenceSettingsProps = {
  spaceSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEnable: boolean;
  enablingTemplateId: string | null;
  onEnableTemplate: (packId: string, templateId: string) => Promise<void>;
};

function PackTemplatePreview({
  template,
  typeLabel,
}: {
  template: PackTemplate;
  typeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const renderedBody = useMemo(
    () => <MarkdownSuspense>{template.body}</MarkdownSuspense>,
    [template.body],
  );

  return (
    <details
      className="group rounded-md border border-border bg-background"
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-2 [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
        <span className="shrink-0 font-mono text-1 text-muted-foreground">
          {template.pack_alias}
        </span>
        <span className="min-w-0 flex-1 truncate">{template.title}</span>
        <span className="shrink-0 text-1 text-muted-foreground">
          {typeLabel}
        </span>
      </summary>
      {open ? (
        <div className="h-[min(28rem,50dvh)] overflow-y-scroll overscroll-contain border-t border-border px-4 py-3 [scrollbar-gutter:stable]">
          {renderedBody}
        </div>
      ) : null}
    </details>
  );
}

export const SpaceIntelligenceSettings: FC<SpaceIntelligenceSettingsProps> = ({
  spaceSlug,
  open,
  onOpenChange,
  canEnable,
  enablingTemplateId,
  onEnableTemplate,
}) => {
  const t = useTranslations('CoherenceTab');
  const { getAccessToken } = useAuthentication();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR(
    open ? ([SPACE_INTELLIGENCE_PACKS_SWR_KEY, spaceSlug] as const) : null,
    async ([, slug]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/v1/spaces/${slug}/intelligence/packs`, {
        headers,
      });
      const payload = (await res.json().catch(() => ({}))) as PacksResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
      return payload;
    },
  );

  const packs = data?.available ?? [];

  const enableTemplate = async (packId: string, templateId: string) => {
    setActionError(null);
    try {
      await onEnableTemplate(packId, templateId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(56rem,calc(100vw-var(--sidebar-left-width,0px)-var(--sidebar-right-width,0px)-2rem))]">
        <DialogHeader>
          <DialogTitle>{t('spaceIntelligenceConfigure')}</DialogTitle>
          <DialogDescription>
            {t('spaceIntelligenceConfigureDescription')}
          </DialogDescription>
        </DialogHeader>
        {actionError ? (
          <p className="text-sm text-destructive">{actionError}</p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive">
            {t('spaceIntelligencePacksLoadError')}
          </p>
        ) : isLoading ? (
          <p className="text-2 text-muted-foreground">
            {t('spaceIntelligenceLoading')}
          </p>
        ) : packs.length === 0 ? (
          <p className="text-2 text-muted-foreground">
            {t('spaceIntelligencePacksEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {packs.map((pack) => {
              return (
                <li
                  key={pack.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-neutral-2 p-4"
                >
                  <div className="min-w-0">
                    <h3 className="text-3 font-medium leading-snug">
                      {pack.title}
                    </h3>
                    <p className="mt-1 text-2 text-muted-foreground">
                      {pack.description}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-1 font-medium text-muted-foreground">
                      {t('spaceIntelligencePackTemplates', {
                        count: pack.template_count,
                      })}
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {pack.templates.map((template) => {
                        const typeKey = `intelligenceTypes.${template.type}`;
                        const typeLabel = t.has(typeKey as never)
                          ? t(typeKey as never)
                          : template.type;
                        const busy = enablingTemplateId === template.id;
                        const activated = template.activated === true;
                        return (
                          <li
                            key={template.id}
                            className="flex items-start gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <PackTemplatePreview
                                template={template}
                                typeLabel={typeLabel}
                              />
                            </div>
                            {canEnable ? (
                              activated ? (
                                <span className="mt-1.5 shrink-0 rounded-full bg-accent-3 px-2 py-0.5 text-1 text-accent-11">
                                  {t('spaceIntelligenceTemplateActivated')}
                                </span>
                              ) : (
                                <Button
                                  type="button"
                                  colorVariant="accent"
                                  size="sm"
                                  className="mt-1 shrink-0"
                                  disabled={busy || enablingTemplateId != null}
                                  onClick={() =>
                                    void enableTemplate(pack.id, template.id)
                                  }
                                >
                                  {busy
                                    ? t('spaceIntelligenceActivatingTemplate')
                                    : t('spaceIntelligenceActivateTemplate')}
                                </Button>
                              )
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};

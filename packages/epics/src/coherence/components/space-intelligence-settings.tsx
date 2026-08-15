'use client';

import { FC, useState } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

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
  }>;
};

type PacksResponse = {
  enabled_packs?: string[];
  available?: IntelligencePackPreview[];
};

type SpaceIntelligenceSettingsProps = {
  spaceSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledPacks: string[];
  canEnable: boolean;
  enablingPackId: string | null;
  onEnablePack: (packId: string) => Promise<void>;
};

export const SpaceIntelligenceSettings: FC<SpaceIntelligenceSettingsProps> = ({
  spaceSlug,
  open,
  onOpenChange,
  enabledPacks,
  canEnable,
  enablingPackId,
  onEnablePack,
}) => {
  const t = useTranslations('CoherenceTab');
  const { getAccessToken } = useAuthentication();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR(
    open ? (['space-intelligence-packs', spaceSlug] as const) : null,
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
  const enabled = new Set([...(data?.enabled_packs ?? []), ...enabledPacks]);

  const enablePack = async (packId: string) => {
    setActionError(null);
    try {
      await onEnablePack(packId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
              const isEnabled = enabled.has(pack.id);
              const busy = enablingPackId === pack.id;
              return (
                <li
                  key={pack.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-neutral-2 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-3 font-medium leading-snug">
                        {pack.title}
                      </h3>
                      <p className="mt-1 text-2 text-muted-foreground">
                        {pack.description}
                      </p>
                    </div>
                    {isEnabled ? (
                      <span className="shrink-0 rounded-full bg-accent-3 px-2 py-0.5 text-1 text-accent-11">
                        {t('spaceIntelligencePackEnabled')}
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <p className="mb-1.5 text-1 font-medium text-muted-foreground">
                      {t('spaceIntelligencePackTemplates', {
                        count: pack.template_count,
                      })}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {pack.templates.map((template) => {
                        const typeKey = `intelligenceTypes.${template.type}`;
                        const typeLabel = t.has(typeKey as never)
                          ? t(typeKey as never)
                          : template.type;
                        return (
                          <li
                            key={template.id}
                            className="flex min-w-0 items-baseline gap-2 text-2"
                          >
                            <span className="shrink-0 font-mono text-1 text-muted-foreground">
                              {template.pack_alias}
                            </span>
                            <span className="min-w-0 truncate">
                              {template.title}
                            </span>
                            <span className="shrink-0 text-1 text-muted-foreground">
                              {typeLabel}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {canEnable ? (
                    isEnabled ? (
                      <p className="text-1 text-muted-foreground">
                        {t('spaceIntelligencePackEnabledHint')}
                      </p>
                    ) : (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          colorVariant="accent"
                          size="sm"
                          disabled={busy}
                          onClick={() => void enablePack(pack.id)}
                        >
                          {busy
                            ? t('spaceIntelligenceEnablingPack')
                            : t('spaceIntelligenceEnablePack')}
                        </Button>
                      </div>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};

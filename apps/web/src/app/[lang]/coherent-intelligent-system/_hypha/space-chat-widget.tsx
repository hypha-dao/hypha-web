'use client';

import { z } from 'zod';
import { MessageSquare } from 'lucide-react';
import type {
  WidgetComponentProps,
  WidgetDefinition,
} from '@hypha-platform/epics';

/**
 * #2486 M11 — a "Recent discussion" panel for the coherence surface. v0 is
 * **mocked**: a live Matrix chat embed is the parked "chat as a canvas
 * capability" item (spec §11), and mention-detection isn't built — so this
 * shows a static recent-messages preview and an "Open chat" affordance that
 * fires a normal turn. Real chat lands with #2478 / #2485.
 */
const spaceChatParams = z.object({
  spaceSlug: z.string().trim().min(1).optional(),
});

type SpaceChatParams = z.infer<typeof spaceChatParams>;

const MOCK_MESSAGES = [
  {
    who: 'Mara',
    when: '2h',
    text: 'Bumped the treasury-gap signal — feels like the top thing to align on this cycle.',
  },
  {
    who: 'Ade',
    when: '4h',
    text: '@here the onboarding proposal is ready for a read before we move it to voting.',
  },
  {
    who: 'Ger',
    when: 'yesterday',
    text: 'Added two coherences from the call. Sensemaking session Thursday?',
  },
  {
    who: 'Lin',
    when: 'yesterday',
    text: 'Outcome logged: the rhythms experiment is now the default. Closing that loop.',
  },
] as const;

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function SpaceChatWidget({
  params,
  onEvent,
}: WidgetComponentProps<SpaceChatParams>) {
  const openChat = () =>
    onEvent?.({
      type: 'drill',
      sourceWidgetId: 'space-chat',
      descriptor: {
        itemKind: 'discussion',
        label: 'Recent discussion',
        scope: 'widget',
      },
    });

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>Last mentions</span>
        <span>{params.spaceSlug ?? '—'}</span>
      </div>

      <ul className="flex flex-col divide-y divide-border/60">
        {MOCK_MESSAGES.map((m, i) => (
          <li key={i} className="flex gap-2.5 py-2 first:pt-0 last:pb-0">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-3 text-[10px] font-semibold text-accent-11">
              {initials(m.who)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 text-xs">
                <span className="font-medium text-foreground">{m.who}</span>
                <span className="text-muted-foreground">{m.when}</span>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {m.text}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={openChat}
        className="flex items-center justify-center gap-1.5 rounded-chrome border border-border bg-background py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent-7 hover:text-foreground"
      >
        <MessageSquare className="size-3.5" />
        Open the space chat
      </button>
    </div>
  );
}

export const spaceChatWidget: WidgetDefinition<SpaceChatParams> = {
  id: 'space-chat',
  title: 'Recent discussion',
  paramsSchema: spaceChatParams,
  component: SpaceChatWidget,
  describeForModel: () =>
    "space-chat — a preview of the space's recent chat (mocked in v0). Place it when the member asks what's being discussed or wants the chat. params: spaceSlug (optional).",
};

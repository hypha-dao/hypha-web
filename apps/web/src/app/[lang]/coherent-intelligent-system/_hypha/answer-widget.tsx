'use client';

import type { ReactNode } from 'react';
import { z } from 'zod';
import type { WidgetDefinition } from '@hypha-platform/epics';

/**
 * #2486 M7 — the `answer` widget. Unlike the data widgets (signals / agreements
 * / treasury / space-overview), this one renders text the model supplies in
 * `params.markdown` — used when the member wants the IO's read / an
 * explanation, not a data view. Keeps the canvas non-empty on every
 * substantive turn (the chat reply stays a one-line pointer).
 *
 * Deliberately tiny formatter — no markdown dependency. Handles paragraphs,
 * `#`/`##`/`###` headings, `-`/`*`/`•` bullets, and `**bold**` inline.
 */
const answerParams = z.object({
  markdown: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
});

type AnswerParams = z.infer<typeof answerParams>;

function inline(text: string): ReactNode {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      /^\*\*[^*]+\*\*$/.test(part) ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
}

function AnswerWidget({ params }: { params: AnswerParams }) {
  const lines = params.markdown.replace(/\r\n/g, '\n').split('\n');

  return (
    <div className="flex flex-col p-4">
      {params.title ? (
        <h2 className="mb-2 text-sm font-semibold">{params.title}</h2>
      ) : null}
      <div className="flex flex-col gap-1.5">
        {lines.map((line, i) => {
          const heading = /^(#{1,3})\s+(.*)$/.exec(line);
          if (heading) {
            return (
              <p key={i} className="mt-2 text-sm font-semibold">
                {inline(heading[2] ?? '')}
              </p>
            );
          }
          const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
          if (bullet) {
            return (
              <p
                key={i}
                className="ml-4 text-sm text-foreground/90 before:mr-1.5 before:content-['•']"
              >
                {inline(bullet[1] ?? '')}
              </p>
            );
          }
          if (!line.trim()) return <div key={i} className="h-1.5" />;
          return (
            <p key={i} className="text-sm leading-relaxed text-foreground/90">
              {inline(line)}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export const answerWidget: WidgetDefinition<AnswerParams> = {
  id: 'answer',
  title: 'Answer',
  paramsSchema: answerParams,
  component: AnswerWidget,
  describeForModel: () =>
    'answer — a written answer, explanation, or insight when the member wants your read rather than a data view (e.g. "what\'s our biggest blind spot", "explain this signal"). params: markdown (required — your full response as plain text; simple **bold**, #/## headings and "- " bullets render; do NOT include "let me know if…" filler or a numbered next-steps list — those belong in set_next_actions), title (optional short label).',
};

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export type ScheduleFromSignalInput = {
  coherenceId: number;
  title: string;
  dueAt?: Date | string | null;
};

export function buildScheduleFromSignalDraft(input: ScheduleFromSignalInput): {
  coherenceId: number;
  title: string;
  type: 'call';
  startsAt: Date;
  endsAt: Date;
  allDay: false;
} {
  const startsAt = input.dueAt
    ? new Date(input.dueAt)
    : new Date(Date.now() + DEFAULT_DURATION_MS);
  if (Number.isNaN(startsAt.getTime())) {
    const fallback = new Date(Date.now() + DEFAULT_DURATION_MS);
    return {
      coherenceId: input.coherenceId,
      title: input.title.trim(),
      type: 'call',
      startsAt: fallback,
      endsAt: new Date(fallback.getTime() + DEFAULT_DURATION_MS),
      allDay: false,
    };
  }
  return {
    coherenceId: input.coherenceId,
    title: input.title.trim(),
    type: 'call',
    startsAt,
    endsAt: new Date(startsAt.getTime() + DEFAULT_DURATION_MS),
    allDay: false,
  };
}

export function buildScheduleFromSignalSearchParams(
  input: ScheduleFromSignalInput,
): URLSearchParams {
  const draft = buildScheduleFromSignalDraft(input);
  return new URLSearchParams({
    coherenceId: String(draft.coherenceId),
    title: draft.title,
    type: draft.type,
    startsAt: draft.startsAt.toISOString(),
    endsAt: draft.endsAt.toISOString(),
    allDay: '0',
  });
}

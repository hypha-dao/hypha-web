import type { ReactNode } from 'react';

type TabScreenTitleProps = {
  title: string;
  count?: number | null;
  filters?: ReactNode;
};

function formatCount(count?: number | null): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
    return null;
  }
  return Intl.NumberFormat().format(count);
}

export function TabScreenTitle({ title, count, filters }: TabScreenTitleProps) {
  const formattedCount = formatCount(count);
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-7 font-semibold tracking-tight text-foreground">
        {title}
        {formattedCount ? (
          <span className="ml-2 text-5 font-medium text-muted-foreground">
            | {formattedCount}
          </span>
        ) : null}
      </h1>
      {filters ? <div>{filters}</div> : null}
    </div>
  );
}

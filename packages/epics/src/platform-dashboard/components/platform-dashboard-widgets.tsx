'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';

export function PlatformMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-3 font-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-6 font-semibold">{value}</p>
        {hint ? (
          <p className="mt-1 text-2 text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PlatformBarChart({
  title,
  items,
  valueKey,
  labelKey,
  emptyLabel = 'No data yet.',
}: {
  title: string;
  items: Array<Record<string, string | number>>;
  valueKey: string;
  labelKey: string;
  emptyLabel?: string;
}) {
  const max = Math.max(...items.map((item) => Number(item[valueKey] ?? 0)), 1);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-3 text-muted-foreground">{emptyLabel}</p>
        ) : (
          items.map((item) => {
            const value = Number(item[valueKey] ?? 0);
            const label = String(item[labelKey] ?? '');
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-2">
                  <span>{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

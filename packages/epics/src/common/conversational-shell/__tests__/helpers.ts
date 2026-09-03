import * as React from 'react';

import type { StandardSchemaV1, WidgetDefinition } from '../types';
import { createWidgetRegistry } from '../widget-registry';

/** Standard Schema that echoes the value as a record. */
export function passthroughSchema<
  P = Record<string, unknown>,
>(): StandardSchemaV1<P> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value) => ({ value: (value ?? {}) as P }),
    },
  };
}

/** Standard Schema that requires `spaceSlug: string`. */
export function requiresSpaceSlugSchema(): StandardSchemaV1<{
  spaceSlug: string;
}> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value) => {
        const slug = (value as { spaceSlug?: unknown } | null)?.spaceSlug;
        if (typeof slug !== 'string' || !slug) {
          return { issues: [{ message: 'spaceSlug is required' }] };
        }
        return { value: { spaceSlug: slug } };
      },
    },
  };
}

const NoopComponent: React.ComponentType<{ params: unknown }> = () => null;

export function fakeWidget(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: StandardSchemaV1<any> = passthroughSchema(),
): WidgetDefinition {
  return {
    id,
    title: `${id} widget`,
    paramsSchema: schema as WidgetDefinition['paramsSchema'],
    component: NoopComponent as WidgetDefinition['component'],
    describeForModel: () => `shows ${id}`,
  };
}

export function registryWith(...widgets: WidgetDefinition[]) {
  const registry = createWidgetRegistry();
  for (const widget of widgets) registry.register(widget);
  return registry;
}

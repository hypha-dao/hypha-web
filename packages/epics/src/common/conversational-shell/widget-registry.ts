import type { WidgetDefinition, WidgetRegistry } from './types';

/**
 * Data-driven widget registry (#2486 §4.3). Registration is a manifest line —
 * `registry.register(signalsWidget)` — never a switch in the orchestrator.
 */
export function createWidgetRegistry(): WidgetRegistry {
  const definitions = new Map<string, WidgetDefinition>();

  return {
    register(def) {
      if (definitions.has(def.id)) {
        console.warn(
          `[widget-registry] "${def.id}" is already registered — overwriting`,
        );
      }
      definitions.set(def.id, def as WidgetDefinition);
    },
    get: (id) => definitions.get(id),
    has: (id) => definitions.has(id),
    list: () => [...definitions.values()],
    catalogueForPrompt() {
      if (definitions.size === 0) {
        return 'No canvas widgets are available.';
      }
      return [...definitions.values()]
        .map((def) => `- ${def.id}: ${def.describeForModel()}`)
        .join('\n');
    },
  };
}

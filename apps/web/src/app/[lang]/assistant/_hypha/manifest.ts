import type { WidgetRegistry } from '@hypha-platform/epics';

import { signalsWidget } from './signals-widget';

/**
 * #2486 widget manifest — registration is data. Adding a widget (M5: agreements,
 * treasury, space-overview) is one import + one `register` line here, no
 * orchestrator change.
 */
export function registerHyphaWidgets(registry: WidgetRegistry): void {
  registry.register(signalsWidget);
}

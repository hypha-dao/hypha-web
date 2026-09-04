import type { WidgetRegistry } from '@hypha-platform/epics';

import { signalsWidget } from './signals-widget';
import { agreementsWidget } from './agreements-widget';
import { treasuryWidget } from './treasury-widget';
import { spaceOverviewWidget } from './space-overview-widget';

/**
 * #2486 widget manifest — registration is data. Adding a widget is one import +
 * one `register` line here, no orchestrator change.
 */
export function registerHyphaWidgets(registry: WidgetRegistry): void {
  registry.register(signalsWidget);
  registry.register(agreementsWidget);
  registry.register(treasuryWidget);
  registry.register(spaceOverviewWidget);
}

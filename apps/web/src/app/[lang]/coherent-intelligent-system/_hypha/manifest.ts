import type { WidgetRegistry } from '@hypha-platform/epics';

import { coherenceOverviewWidget } from './coherence-overview-widget';
import { signalsWidget } from './signals-widget';
import { singleSignalWidget } from './single-signal-widget';
import { agreementsWidget } from './agreements-widget';
import { singleAgreementWidget } from './single-agreement-widget';
import { treasuryWidget } from './treasury-widget';
import { spaceOverviewWidget } from './space-overview-widget';
import { membersWidget } from './members-widget';
import { answerWidget } from './answer-widget';

/**
 * #2486 widget manifest — registration is data. Adding a widget is one import +
 * one `register` line here, no orchestrator change.
 */
export function registerHyphaWidgets(registry: WidgetRegistry): void {
  registry.register(coherenceOverviewWidget);
  registry.register(signalsWidget);
  registry.register(singleSignalWidget);
  registry.register(agreementsWidget);
  registry.register(singleAgreementWidget);
  registry.register(treasuryWidget);
  registry.register(spaceOverviewWidget);
  registry.register(membersWidget);
  registry.register(answerWidget);
}

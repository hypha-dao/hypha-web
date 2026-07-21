import type { HighlightsBlock, HighlightsSupportAction } from './types';

function blockId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultHighlightsBlocks(): HighlightsBlock[] {
  const defs: Array<{
    type: HighlightsBlock['type'];
    title: string;
  }> = [
    { type: 'about', title: 'About us' },
    { type: 'stories', title: "What we've achieved" },
    { type: 'needs', title: 'What we need now' },
    { type: 'useOfFunds', title: 'How resources will be used' },
    { type: 'whyNow', title: 'Why support now' },
    { type: 'gallery', title: 'Gallery' },
    { type: 'cta', title: 'Support' },
  ];

  return defs.map((def, order) => ({
    id: blockId(def.type),
    type: def.type,
    order,
    visible: true,
    title: def.title,
    body: '',
    items: [],
  }));
}

export function createDefaultSupportActions(): HighlightsSupportAction[] {
  return [
    {
      id: blockId('donate'),
      label: 'donate',
      enabled: true,
      destination: 'wallet',
    },
    {
      id: blockId('invest'),
      label: 'invest',
      enabled: false,
      destination: 'wallet',
    },
    {
      id: blockId('support'),
      label: 'support',
      enabled: true,
      destination: 'iban',
    },
  ];
}

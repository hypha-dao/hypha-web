export const MYCELIUM = {
  accent: '#0d9488',
  accentSoft: 'rgba(13, 148, 136, 0.18)',
  hypha: '#5eead4',
  hyphaMuted: 'rgba(45, 212, 191, 0.35)',
  personRing: '#f0fdfa',
  spaceRing: '#ccfbf1',
  external: '#94a3b8',
  linkDark: 'rgba(45, 212, 191, 0.42)',
  linkLight: 'rgba(13, 148, 136, 0.38)',
  canvasMinHeight: 420,
} as const;

export function myceliumLinkColor(isDark: boolean): string {
  return isDark ? MYCELIUM.linkDark : MYCELIUM.linkLight;
}

export function myceliumNodeRadius(kind: string): number {
  switch (kind) {
    case 'hub':
      return 28;
    case 'space':
      return 22;
    case 'person':
      return 16;
    default:
      return 14;
  }
}

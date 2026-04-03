/**
 * Generate a deterministic hue from a string (for avatar background color).
 */
export function stringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/**
 * Get initials from a name (up to 2 characters).
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]?.charAt(0).toUpperCase() ?? '';
  return (
    (parts[0]?.charAt(0) ?? '') + (parts[1]?.charAt(0) ?? '')
  ).toUpperCase();
}

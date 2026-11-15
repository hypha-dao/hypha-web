/**
 * The section's own URL: no overlay. Without this page, a soft navigation back
 * to the list would keep showing the previous overlay (a slot keeps its last
 * state unless a page matches the new URL; `default.tsx` only covers hard loads).
 */
export default function Page() {
  return null;
}

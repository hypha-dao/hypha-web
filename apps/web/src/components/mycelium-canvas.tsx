/**
 * Fixed website mycelium photograph behind the app shell.
 * CSS tokens (--hypha-mycelium-*) match https://io.hypha.earth/website.
 * Must stay a real <img> (not body::before) so the open canvas cannot paint over it.
 */
export function MyceliumCanvas() {
  return (
    <div data-hypha-mycelium aria-hidden className="hypha-mycelium-root">
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed full-bleed canvas, not content imagery */}
      <img src="/brand/mycelium.jpg" alt="" className="hypha-mycelium-photo" />
      <div className="hypha-mycelium-veil" />
    </div>
  );
}

type Listener = () => void;

let globeReady = false;
const listeners = new Set<Listener>();

export function getNetworkGlobeReady(): boolean {
  return globeReady;
}

export function setNetworkGlobeReady(next: boolean): void {
  if (globeReady === next) {
    return;
  }
  globeReady = next;
  listeners.forEach((listener) => listener());
}

export function subscribeNetworkGlobeReady(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

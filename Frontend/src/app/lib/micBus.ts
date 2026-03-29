type Listener = (active: boolean) => void;
const listeners = new Set<Listener>();

export function onMicActive(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitMicActive(active: boolean): void {
  listeners.forEach((fn) => fn(active));
}

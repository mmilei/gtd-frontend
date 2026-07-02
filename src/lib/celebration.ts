type Listener = () => void

const listeners = new Set<Listener>()

/** Fire a celebration (particle burst in the ambient scene, if mounted). */
export function celebrate(): void {
  listeners.forEach(fn => fn())
}

export function onCelebrate(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

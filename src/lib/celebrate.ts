type Listener = () => void;

const listeners = new Set<Listener>();

/** Plays the lime-ball moment over whatever screen is open (a match was published or joined). */
export function celebrate() {
  listeners.forEach((listener) => listener());
}

/** Used by `Celebration`, mounted once at the root. Returns the unsubscribe function. */
export function subscribeToCelebrate(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

import { useEffect, useState } from "react";

/** False on the first render, true a frame later: lets a screen skip entrance animations for what is already there when it opens. */
export function useHasMounted() {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return hasMounted;
}

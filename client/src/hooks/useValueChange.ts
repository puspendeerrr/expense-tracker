import { useEffect, useRef, useState } from 'react';

/**
 * Marks a figure that changed while someone was looking at it.
 *
 * This app updates balances over a socket, so a number can move with no interaction at
 * all. Silently swapping one amount for another is the worst version of that: the
 * screen is briefly lying about what the person last read, and they have no way to
 * know which figure moved. A short animation on the changed value is the smallest
 * honest fix.
 *
 * Returns a class name, not a boolean, so the caller cannot accidentally leave the
 * animation running -- it clears itself.
 *
 * The first render never animates. Arriving at a screen is not a change, and animating
 * every figure on load is the noise that makes people stop noticing real movement.
 */
export const useValueChange = (value: number | null | undefined): string => {
  const previous = useRef(value);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (previous.current === value) return;

    // Skip the transition out of "not loaded yet": null to a real figure is the first
    // paint of that number, not a change to it.
    const wasUnset = previous.current === null || previous.current === undefined;
    previous.current = value;
    if (wasUnset) return;

    setChanged(true);
    const timer = window.setTimeout(() => setChanged(false), 500);
    return () => window.clearTimeout(timer);
  }, [value]);

  return changed ? 'animate-value-change' : '';
};

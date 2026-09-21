import { useEffect, useRef, useState } from 'react';

/**
 * Seconds remaining until a server-supplied instant, counted down once a second.
 *
 * ANCHORED TO THE SERVER'S CLOCK, NOT THE PHONE'S. A device whose clock is wrong by an
 * hour would otherwise show a resend timer that never reaches zero, or one that is already
 * expired — and the user has no way to tell which. The offset between the two clocks is
 * measured once from `serverTime`, and every tick is computed through it.
 *
 * Returns 0 when there is nothing to wait for, so callers can test `> 0` without caring
 * whether a challenge exists yet.
 */
export function useCountdown(target?: string, serverTime?: string): number {
  const [remaining, setRemaining] = useState(0);

  /** How far the phone's clock is ahead of the server's, in milliseconds. */
  const skew = useRef(0);

  useEffect(() => {
    if (!target) {
      setRemaining(0);
      return;
    }

    skew.current = serverTime ? Date.now() - new Date(serverTime).getTime() : 0;

    const deadline = new Date(target).getTime();
    if (Number.isNaN(deadline)) {
      setRemaining(0);
      return;
    }

    const tick = (): void => {
      const left = Math.ceil((deadline - (Date.now() - skew.current)) / 1000);
      setRemaining(left > 0 ? left : 0);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target, serverTime]);

  return remaining;
}

import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetIso: string;
  serverTimeIso: string;
  onExpire?: () => void;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetIso,
  serverTimeIso,
  onExpire,
  prefix = '',
  suffix = 's',
  className,
}) => {
  // Clock offset between client machine and backend server
  const [clockOffset] = useState<number>(() => {
    const serverMs = new Date(serverTimeIso).getTime();
    const clientMs = Date.now();
    return Number.isNaN(serverMs) ? 0 : serverMs - clientMs;
  });

  const calculateRemaining = (): number => {
    const targetMs = new Date(targetIso).getTime();
    if (Number.isNaN(targetMs)) return 0;
    const currentServerMs = Date.now() + clockOffset;
    return Math.max(0, Math.ceil((targetMs - currentServerMs) / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState<number>(calculateRemaining);

  useEffect(() => {
    setSecondsLeft(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetIso, serverTimeIso]);

  if (secondsLeft <= 0) {
    return null;
  }

  return (
    <span className={className}>
      {prefix}
      {secondsLeft}
      {suffix}
    </span>
  );
};


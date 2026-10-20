import React, { useState, useEffect } from 'react';

function Timer({ timeLeft }) {
  const [time, setTime] = useState(timeLeft);

  useEffect(() => {
      setTime(timeLeft);

      const timer = setInterval(() => {
        setTime(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }

          return prev - 1;
        });
      }, 1000);

      return () => { clearInterval(timer) };
  }, [timeLeft]);

  return <>{time <= 0 ? 'Released!' : formatTime(time)}</>;
}

export function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${remainingSeconds.toString().padStart(2, '0')}s`;
}

export default Timer;

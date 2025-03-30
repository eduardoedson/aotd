import React, { useState, useEffect } from 'react';

function Timer({ timeLeft }) {
  const [time, setTime] = useState(timeLeft);

  useEffect(() => {
      const timer = setInterval(() => {
        setTime(prev => prev - 1);
      }, 1000);

      return () => { clearInterval(timer) };
  }, [time]);

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secondsRestantes = seconds % 60;

    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${secondsRestantes.toString().padStart(2, '0')}s`;
  }

  return <>{timeLeft <= 0 ? 'Released!' : formatTime(time)}</>;
}

export default Timer;

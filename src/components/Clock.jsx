import React, { useState, useEffect } from 'react';
import { weekDays, months } from '../services/globals';

function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
        setNow(new Date());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const formatClock = (date) => {
    const weekDay = weekDays[date.getUTCDay()];
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = months[date.getUTCMonth()];
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');

    return `${weekDay}, ${month} ${day}, ${hours}:${minutes}:${seconds} - UTC`;
  };

  return (<div className='clock-container'>{formatClock(now)}</div>);
}

export default Clock;

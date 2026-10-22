import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// One live connection to the server for the whole Studio.
//  - 'query'         arrives after every Storefront search, with the engine's trace
//  - 'index-changed' arrives after every catalogue change, with fresh totals
const StudioContext = createContext(null);

export function StudioProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [feed, setFeed] = useState([]);
  const [overview, setOverview] = useState(null);
  const [changeTick, setChangeTick] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const socket = io();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('query', (q) => setFeed((list) => [q, ...list].slice(0, 30)));
    socket.on('index-changed', (e) => { setOverview(e.overview); setChangeTick((t) => t + 1); });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { socket.close(); clearInterval(timer); };
  }, []);

  return (
    <StudioContext.Provider value={{ connected, feed, overview, changeTick, now }}>
      {children}
    </StudioContext.Provider>
  );
}

export const useStudio = () => useContext(StudioContext);

import { useState, useEffect } from 'react';
import { serverAPI } from '../services/api';
import socketService from '../services/socket';
import { PANEL_VERSION } from '../config';

export function useServerStatus() {
  const [status, setStatus] = useState('offline');
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState({
    uptime: '0d 00h 00m 00s',
    cpu: 0,
    gpu: null,
    memory: 0,
    memoryPercent: 0,
    systemMemoryPercent: 0,
    tps: null,
    players: { online: 0, max: 20 },
    version: `Minecraft Panel ${PANEL_VERSION}`,
    worldSize: '0 MB',
    playersOnline: 0,
    playersMax: 20
  });

  useEffect(() => {
    // Connect socket
    socketService.connect();

    // Get initial status
    serverAPI.getStatus()
      .then(response => {
        setStatus(response.data.status);
        if (response.data.config) {
          setConfig(response.data.config);
        }
        if (response.data.stats) {
          setStats(prev => ({ ...prev, ...response.data.stats }));
        }
      })
      .catch(error => {
        console.error('Failed to get server status:', error);
      });

    // Listen for status updates
    const handleStatus = (data) => {
      if (data.status) {
        setStatus(data.status);
      }
      if (data.config) {
        setConfig(data.config);
      }
    };

    const handleStats = (newStats) => {
      setStats(prev => ({ ...prev, ...newStats }));
    };

    socketService.on('status', handleStatus);
    socketService.on('stats', handleStats);

    // Cleanup
    return () => {
      socketService.off('status', handleStatus);
      socketService.off('stats', handleStats);
    };
  }, []);

  return {
    status,
    stats,
    config,
    players: stats.players
  };
}

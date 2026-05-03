import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import Ansi from 'ansi-to-react';
import { useServerStatus } from '../hooks/useServerStatus';
import socketService from '../services/socket';
import './ConsolePage.css';

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function getLogLevelClass(log) {
  const text = String(log || '').toLowerCase();

  if (text.startsWith('>')) return 'log-command';

  if (
    /\b(error|err|severe|fatal|exception|failed|crash(ed)?)\b/.test(text) ||
    /\s+error\s*:/.test(text)
  ) {
    return 'log-error';
  }

  if (/\b(warn|warning)\b/.test(text)) {
    return 'log-warning';
  }

  if (
    /\b(done!?|success|successful(ly)?|started|online|initialized|ready)\b/.test(text) ||
    /\binfo\b/.test(text)
  ) {
    return 'log-success';
  }

  return 'log-info';
}

function ConsolePage() {
  const { status, stats } = useServerStatus();
  const [logs, setLogs] = useState([]);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const consoleOutputRef = useRef(null);
  const inputRef = useRef(null);
  const sawStopMarkerRef = useRef(false);
  const startMarkerPatternRef = useRef(/Starting org\.bukkit\.craftbukkit\.Main/i);
  const stopMarkerPatternRef = useRef(/Server stopped with code 0/i);

  const hasRamPercent = Number.isFinite(Number(stats.memoryPercent));
  const ramPercent = hasRamPercent ? clampPercent(stats.memoryPercent) : 0;
  const cpuPercent = clampPercent(stats.cpu ?? 0);
  const hasGpu = Number.isFinite(Number(stats.gpu ?? stats.gpuUsage));
  const gpuPercent = hasGpu ? clampPercent(stats.gpu ?? stats.gpuUsage) : 0;
  const hasSystemMemoryPercent = Number.isFinite(Number(stats.systemMemoryPercent));
  const memoryPercent = hasSystemMemoryPercent ? clampPercent(stats.systemMemoryPercent) : 0;
  const tpsNumeric = Number(stats.tps);
  const hasTps = Number.isFinite(tpsNumeric);
  const tpsPercent = hasTps ? clampPercent((tpsNumeric / 20) * 100) : 0;

  const gauges = [
    { key: 'ram', label: 'RAM', valueLabel: hasRamPercent ? `${Math.round(ramPercent)}%` : 'N/A', percent: ramPercent, unavailable: !hasRamPercent },
    { key: 'cpu', label: 'CPU', valueLabel: `${Math.round(cpuPercent)}%`, percent: cpuPercent },
    { key: 'gpu', label: 'GPU', valueLabel: hasGpu ? `${Math.round(gpuPercent)}%` : 'N/A', percent: gpuPercent, unavailable: !hasGpu },
    { key: 'memory', label: 'Memory', valueLabel: hasSystemMemoryPercent ? `${Math.round(memoryPercent)}%` : 'N/A', percent: memoryPercent, unavailable: !hasSystemMemoryPercent },
    { key: 'tps', label: 'TPS', valueLabel: hasTps ? tpsNumeric.toFixed(1) : 'N/A', percent: tpsPercent, unavailable: !hasTps }
  ];

  useEffect(() => {
    socketService.connect();

    const handleConsole = (data) => {
      const line = String(data || '');
      const isStopMarker = stopMarkerPatternRef.current.test(line);
      const isStartMarker = startMarkerPatternRef.current.test(line);

      if (isStopMarker) {
        sawStopMarkerRef.current = true;
        setCommand('');
      }

      if (isStartMarker) {
        setCommand('');
        if (sawStopMarkerRef.current) {
          sawStopMarkerRef.current = false;
          setLogs([line]);
          return;
        }
      }

      setLogs(prev => [...prev, data]);
    };

    const handleHistory = (history) => {
      const safeHistory = Array.isArray(history) ? history : [];
      setLogs((prev) => (safeHistory.length >= prev.length ? safeHistory : prev));
    };

    socketService.on('console', handleConsole);
    socketService.on('consoleHistory', handleHistory);

    socketService.emit('getConsoleHistory');

    return () => {
      socketService.off('console', handleConsole);
      socketService.off('consoleHistory', handleHistory);
    };
  }, []);

  useEffect(() => {
    if (status === 'starting') {
      setCommand('');
    }
  }, [status]);

  useEffect(() => {
    if (consoleOutputRef.current) {
      consoleOutputRef.current.scrollTop = consoleOutputRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!command.trim()) return;

    setLogs(prev => [...prev, `> ${command}\n`]);

    socketService.sendCommand(command);

    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);

    setCommand('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex + 1;
        if (newIndex < commandHistory.length) {
          setHistoryIndex(newIndex);
          setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  return (
    <div className="console-page fade-in">
      <div className="console-gauges card">
        <div className="console-gauge-row">
          {gauges.map((gauge) => (
            <div key={gauge.key} className="console-gauge-tile">
              <div
                className={`console-gauge-ring ${gauge.unavailable ? 'unavailable' : ''}`}
                style={{
                  background: `conic-gradient(var(--minecraft-green-light) ${gauge.percent * 1.8}deg, var(--bg-tertiary) ${gauge.percent * 1.8}deg 180deg)`
                }}
              >
                <div className="console-gauge-inner">
                  <span className="console-gauge-value">{gauge.valueLabel}</span>
                </div>
              </div>
              <span className="console-gauge-label">{gauge.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="console-header">
        <h1 className="page-title">Server Console</h1>
        <p className="page-subtitle">Real-time server output and command execution</p>
      </div>

      <div className="console-container">
        <div className="console-output" ref={consoleOutputRef}>
          {logs.map((log, index) => (
            <div key={index} className={`console-line ${getLogLevelClass(log)}`}>
              <Ansi linkify={false}>{log}</Ansi>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="console-input-form">
          <div className="input-wrapper">
            <span className="input-prefix">&gt;</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter command..."
              className="console-input"
              autoFocus
            />
            <button type="submit" className="btn btn-primary send-btn">
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ConsolePage;

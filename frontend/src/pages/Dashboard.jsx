import { useServerStatus } from '../hooks/useServerStatus';
import ServerControls from '../components/server/ServerControls';
import ServerInfo from '../components/server/ServerInfo';
import './Dashboard.css';

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function Dashboard() {
  const { status, stats, config } = useServerStatus();
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

  return (
    <div className="dashboard fade-in">
      <div className="dashboard-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Server overview and controls</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-section">
          <div className="card managers-card">
            <h3 className="card-title">Managers</h3>
            <div className="gauge-grid">
              {gauges.map((gauge) => (
                <div key={gauge.key} className="gauge-tile">
                  <div
                    className={`gauge-ring ${gauge.unavailable ? 'unavailable' : ''}`}
                    style={{
                      background: `conic-gradient(var(--minecraft-green-light) ${gauge.percent * 1.8}deg, var(--bg-tertiary) ${gauge.percent * 1.8}deg 180deg)`
                    }}
                  >
                    <div className="gauge-inner">
                      <span className="gauge-value">{gauge.valueLabel}</span>
                    </div>
                  </div>
                  <span className="gauge-label">{gauge.label}</span>
                </div>
              ))}
            </div>
            <div className="managers-controls">
              <ServerControls status={status} embedded />
            </div>
          </div>
        </div>

        <div className="dashboard-section">
          <ServerInfo stats={stats} config={config} className="full-height" />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

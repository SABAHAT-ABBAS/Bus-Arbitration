import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Cpu, HardDrive, Layers, Clock3, Play, Pause, SkipForward, RefreshCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, CartesianGrid } from 'recharts';
import { SimulationEngine, SimulationConfig, defaultDevices } from './model/simulation';
import { ArbitrationAlgorithm, ControlSignalState, DeviceConfig, SimulationMetrics } from './types';

const DEFAULT_CONFIG: SimulationConfig = {
  algorithm: 'Round Robin',
  globalTraffic: 1,
  clockInterval: 700,
  totalCycles: 300,
  alpha: 0.8,
  beta: 0.6,
};

const algorithmOptions: ArbitrationAlgorithm[] = ['Daisy Chain', 'Round Robin', 'Centralized Fixed Priority', 'Centralized Parallel', 'Dynamic Priority'];

function buildChartHistory(metricsHistory: SimulationMetrics[]) {
  return metricsHistory.map((entry, index) => ({
    cycle: index + 1,
    utilization: entry.busUtilization,
    throughput: entry.throughput,
    waitTime: entry.averageWaitingTime,
  }));
}

function App() {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [deviceConfig, setDeviceConfig] = useState<DeviceConfig[]>(defaultDevices);
  const [simulationDevices, setSimulationDevices] = useState<DeviceConfig[]>(defaultDevices);
  const [running, setRunning] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<SimulationMetrics[]>([]);
  const [simulationMetrics, setSimulationMetrics] = useState<SimulationMetrics>({ elapsedCycles: 0, activeCycles: 0, busUtilization: 0, throughput: 0, averageWaitingTime: 0 });
  const [busOwnerId, setBusOwnerId] = useState<string | null>(null);
  const [controlState, setControlState] = useState<ControlSignalState>({
    brActive: false,
    bgActive: false,
    bbsyActive: false,
    bgReachIndex: -1,
    bgInterceptIndex: null,
    bgGrantDeviceId: null,
    bbsyOwnerId: null,
    fixedPriorityRequestStates: defaultDevices.map(() => false),
    fixedPriorityGrantIndex: null,
    parallelRequestStates: defaultDevices.map(() => false),
    parallelEncoderBits: [0, 0],
    parallelDecoderActiveIndex: null,
    rrRequestMap: defaultDevices.map(() => false),
    rrOldIndex: null,
    rrNewIndex: null,
    rrNextCheckCycles: null,
  });
  const [cycleCount, setCycleCount] = useState(0);
  const engineRef = useRef(new SimulationEngine(deviceConfig, config));

  useEffect(() => {
    engineRef.current.reset(deviceConfig, config);
    setSimulationDevices(deviceConfig.map((device) => ({ ...device })));
    setCycleCount(0);
    setMetricsHistory([]);
    setSimulationMetrics({ elapsedCycles: 0, activeCycles: 0, busUtilization: 0, throughput: 0, averageWaitingTime: 0 });
    setBusOwnerId(null);
    setControlState({
      brActive: false,
      bgActive: false,
      bbsyActive: false,
      bgReachIndex: -1,
      bgInterceptIndex: null,
      bgGrantDeviceId: null,
      bbsyOwnerId: null,
      fixedPriorityRequestStates: deviceConfig.map(() => false),
      fixedPriorityGrantIndex: null,
      parallelRequestStates: deviceConfig.map(() => false),
      parallelEncoderBits: [0, 0],
      parallelDecoderActiveIndex: null,
      rrRequestMap: deviceConfig.map(() => false),
      rrOldIndex: null,
      rrNewIndex: null,
      rrNextCheckCycles: null,
    });
  }, [deviceConfig, config]);

  useEffect(() => {
    if (!running) return;
    const handle = window.setInterval(() => {
      runCycle();
    }, config.clockInterval);
    return () => window.clearInterval(handle);
  }, [running, config.clockInterval]);

  const runCycle = () => {
    const result = engineRef.current.step();
    setSimulationDevices([...result.devices]);
    setBusOwnerId(result.busOwnerId);
    setControlState(result.controlState);
    setSimulationMetrics(result.metrics);
    setMetricsHistory((prev) => [...prev, result.metrics]);
    setCycleCount((prev) => prev + 1);
    if (result.metrics.elapsedCycles >= config.totalCycles) {
      setRunning(false);
    }
  };

  const resetSimulation = () => {
    engineRef.current.reset(deviceConfig, config);
    setSimulationDevices(deviceConfig.map((device) => ({ ...device })));
    setCycleCount(0);
    setMetricsHistory([]);
    setSimulationMetrics({ elapsedCycles: 0, activeCycles: 0, busUtilization: 0, throughput: 0, averageWaitingTime: 0 });
    setBusOwnerId(null);
    setControlState({
      brActive: false,
      bgActive: false,
      bbsyActive: false,
      bgReachIndex: -1,
      bgInterceptIndex: null,
      bgGrantDeviceId: null,
      bbsyOwnerId: null,
      fixedPriorityRequestStates: deviceConfig.map(() => false),
      fixedPriorityGrantIndex: null,
      parallelRequestStates: deviceConfig.map(() => false),
      parallelEncoderBits: [0, 0],
      parallelDecoderActiveIndex: null,
      rrRequestMap: deviceConfig.map(() => false),
      rrOldIndex: null,
      rrNewIndex: null,
      rrNextCheckCycles: null,
    });
    setRunning(false);
  };

  const handleAlgorithmChange = (algorithm: ArbitrationAlgorithm) => {
    setConfig((current) => ({ ...current, algorithm }));
  };

  const handleDeviceField = (id: string, field: keyof Pick<DeviceConfig, 'requestRate' | 'holdCycles' | 'basePriority'>, value: number) => {
    setDeviceConfig((current) => current.map((device) => (device.id === id ? { ...device, [field]: value } : device)));
    setSimulationDevices((current) => current.map((device) => (device.id === id ? { ...device, [field]: value } : device)));
  };

  const summary = useMemo(() => buildChartHistory(metricsHistory), [metricsHistory]);

  const schematicWidth = Math.max(760, simulationDevices.length * 140 + 260);
  const devicePositions = simulationDevices.map((_, index) => 180 + index * 140);
  const activeBgX = controlState.bgReachIndex >= 0 ? devicePositions[controlState.bgReachIndex] : 180;
  const bbsyOwnerIndex = simulationDevices.findIndex((device) => device.id === controlState.bbsyOwnerId);
  const bbsyOwnerX = bbsyOwnerIndex >= 0 ? devicePositions[bbsyOwnerIndex] : null;

  const getPrioritySublabel = (device: DeviceConfig, index: number) => {
    switch (config.algorithm) {
      case 'Daisy Chain':
        return `Priority: ${index + 1} (Highest to Lowest)`;
      case 'Centralized Fixed Priority': {
        const tier = device.basePriority >= 4 ? 'High' : device.basePriority >= 2 ? 'Medium' : 'Low';
        return `Static Priority: ${tier}`;
      }
      case 'Centralized Parallel':
        return `Encoder Vector: Y${index}`;
      case 'Round Robin': {
        const nextIndex = controlState.rrNewIndex;
        if (nextIndex === index && controlState.rrNextCheckCycles !== null) {
          return `Next In Rotation: ${controlState.rrNextCheckCycles} cycles`;
        }
        return `Time-Slice Slot: M${index + 1}`;
      }
      default:
        return '';
    }
  };

  const renderDaisyChainView = () => (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Daisy Chain View</p>
            <p className="mt-1 text-sm text-slate-500">Serial BG path, shared BRQ line, and shared SACK busy rail.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-300">BRQ = {controlState.brActive ? '0 asserted' : '1 idle'}</div>
        </div>
      </div>
      <svg width="100%" height="320" viewBox={`0 0 ${schematicWidth} 320`} className="rounded-3xl bg-slate-950/80 p-4">
        <defs>
          <linearGradient id="systemBusGradientDC" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
        <line x1={110} y1={120} x2={schematicWidth - 30} y2={120} className="stroke-slate-700 stroke-[6]" />
        <line x1={110} y1={160} x2={schematicWidth - 30} y2={160} className="stroke-slate-700 stroke-[6]" />
        <line x1={110} y1={200} x2={schematicWidth - 30} y2={200} className="stroke-slate-700 stroke-[6]" />
        <line x1={110} y1={260} x2={schematicWidth - 30} y2={260} stroke="url(#systemBusGradientDC)" strokeWidth={10} strokeLinecap="round" />

        {controlState.brActive && (
          <line x1={110} y1={120} x2={schematicWidth - 30} y2={120} stroke="#facc15" strokeWidth={6} className="signal-line" />
        )}
        {controlState.bgActive && (
          <>
            <line x1={110} y1={160} x2={activeBgX} y2={160} stroke="#38bdf8" strokeWidth={6} className="signal-line" />
            <line x1={activeBgX} y1={160} x2={schematicWidth - 30} y2={160} stroke="#475569" strokeWidth={4} opacity="0.32" />
          </>
        )}
        {controlState.bbsyActive && (
          <line x1={110} y1={200} x2={schematicWidth - 30} y2={200} stroke="#4ade80" strokeWidth={6} className="signal-line" />
        )}

        <rect x={60} y={60} width={100} height={80} rx={20} fill="#0f172a" stroke="#334155" strokeWidth={2} />
        <text x={110} y={104} textAnchor="middle" className="text-[13px] font-semibold fill-slate-100">Bus Arbiter</text>

        {simulationDevices.map((device, index) => {
          const x = devicePositions[index];
          const requesting = device.requesting && !device.usingBus;
          const active = controlState.bgGrantDeviceId === device.id;
          return (
            <g key={device.id}>
              <rect x={x - 70} y={32} width={140} height={60} rx={18} fill="#0f172a" stroke="#334155" strokeWidth={2} />
              <text x={x} y={62} textAnchor="middle" className="text-[12px] font-semibold fill-slate-100">{device.name}</text>
              <text x={x} y={82} textAnchor="middle" className="text-[10px] fill-slate-400">{getPrioritySublabel(device, index)}</text>
              <line x1={x} y1={95} x2={x} y2={132} stroke={requesting ? '#facc15' : '#334155'} strokeWidth={2} />
              {requesting && <circle cx={x} cy={120} r={4} fill="#facc15" />}
              {active && <circle cx={x} cy={160} r={6} fill="#38bdf8" />}
              {active && <line x1={x} y1={160} x2={x} y2={180} stroke="#38bdf8" strokeWidth={2} />}
            </g>
          );
        })}
      </svg>
    </div>
  );

  const renderCentralizedFixedView = () => (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Centralized Fixed Priority View</p>
            <p className="mt-1 text-sm text-slate-500">Independent parallel request/grant lines to the arbiter hub.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-300">Static Priority</div>
        </div>
      </div>
      <svg width="100%" height="320" viewBox={`0 0 ${schematicWidth} 320`} className="rounded-3xl bg-slate-950/80 p-4">
        <rect x={60} y={120} width={100} height={80} rx={20} fill="#0f172a" stroke="#334155" strokeWidth={2} />
        <text x={110} y={152} textAnchor="middle" className="text-[13px] font-semibold fill-slate-100">Bus Arbiter</text>

        {simulationDevices.map((device, index) => {
          const x = devicePositions[index];
          const requesting = controlState.fixedPriorityRequestStates[index];
          const granted = controlState.fixedPriorityGrantIndex === index;
          return (
            <g key={device.id}>
              <rect x={x - 70} y={32} width={140} height={60} rx={18} fill="#0f172a" stroke="#334155" strokeWidth={2} />
              <text x={x} y={62} textAnchor="middle" className="text-[12px] font-semibold fill-slate-100">{device.name}</text>
              <text x={x} y={82} textAnchor="middle" className="text-[10px] fill-slate-400">{getPrioritySublabel(device, index)}</text>
              <polyline points={`${x},95 ${x},132 110,132`} fill="none" stroke={requesting ? '#facc15' : '#334155'} strokeWidth={2} />
              {granted && <polyline points={`110,200 110,180 ${x},180 ${x},135`} fill="none" stroke="#38bdf8" strokeWidth={3} />}
              {granted && <circle cx={x} cy={135} r={4} fill="#38bdf8" />}
            </g>
          );
        })}
      </svg>
    </div>
  );

  const renderCentralizedParallelView = () => {
    const centerX = 180 + ((simulationDevices.length - 1) * 140) / 2;
    const [bit1, bit0] = controlState.parallelEncoderBits;
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Centralized Parallel View</p>
              <p className="mt-1 text-sm text-slate-500">Encoder/decoder matrix with shared bus busy rail.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-300">Encoder/Decoder</div>
          </div>
        </div>
        <svg width="100%" height="360" viewBox={`0 0 ${schematicWidth} 360`} className="rounded-3xl bg-slate-950/80 p-4">
          <rect x={centerX - 70} y={110} width={140} height={70} rx={18} fill="#0f172a" stroke="#334155" strokeWidth={2} />
          <text x={centerX} y={145} textAnchor="middle" className="text-[12px] font-semibold fill-slate-100">Priority Encoder</text>
          <rect x={centerX - 70} y={210} width={140} height={70} rx={18} fill="#0f172a" stroke="#334155" strokeWidth={2} />
          <text x={centerX} y={245} textAnchor="middle" className="text-[12px] font-semibold fill-slate-100">Decoder</text>

          {simulationDevices.map((device, index) => {
            const x = devicePositions[index];
            const requesting = controlState.parallelRequestStates[index];
            const granted = controlState.parallelDecoderActiveIndex === index;
            return (
              <g key={device.id}>
                <rect x={x - 70} y={32} width={140} height={60} rx={18} fill="#0f172a" stroke="#334155" strokeWidth={2} />
                <text x={x} y={62} textAnchor="middle" className="text-[12px] font-semibold fill-slate-100">{device.name}</text>
                <text x={x} y={82} textAnchor="middle" className="text-[10px] fill-slate-400">{getPrioritySublabel(device, index)}</text>
                <line x1={x} y1={95} x2={x} y2={110} stroke={requesting ? '#facc15' : '#334155'} strokeWidth={2} />
                <line x1={x} y1={110} x2={centerX - 30} y2={110} stroke={requesting ? '#facc15' : '#334155'} strokeWidth={2} />
                {granted && <polyline points={`${centerX - 30},250 ${centerX + 30},250 ${x},250 ${x},180`} fill="none" stroke="#38bdf8" strokeWidth={3} />}
              </g>
            );
          })}
          <line x1={centerX - 40} y1={150} x2={centerX - 40} y2={210} stroke={bit1 ? '#38bdf8' : '#475569'} strokeWidth={4} />
          <line x1={centerX + 40} y1={150} x2={centerX + 40} y2={210} stroke={bit0 ? '#38bdf8' : '#475569'} strokeWidth={4} />
          <text x={centerX - 40} y={165} textAnchor="middle" className="text-[10px] fill-slate-400">A1</text>
          <text x={centerX + 40} y={165} textAnchor="middle" className="text-[10px] fill-slate-400">A0</text>

          <line x1={110} y1={280} x2={schematicWidth - 30} y2={280} className="stroke-slate-700 stroke-[6]" />
          {controlState.bbsyActive && <line x1={110} y1={280} x2={schematicWidth - 30} y2={280} stroke="#4ade80" strokeWidth={6} className="signal-line" />}
        </svg>
      </div>
    );
  };

  const renderRoundRobinView = () => {
    const wheelCenterX = schematicWidth - 220;
    const wheelCenterY = 190;
    const radius = 80;
    const segments = simulationDevices.length;
    const pointerAngle = controlState.rrNewIndex !== null ? (controlState.rrNewIndex * (360 / segments) - 90) : -90;
    const oldAngle = controlState.rrOldIndex !== null ? (controlState.rrOldIndex * (360 / segments) - 90) : -90;
    const pointerX = wheelCenterX + Math.cos((pointerAngle * Math.PI) / 180) * radius;
    const pointerY = wheelCenterY + Math.sin((pointerAngle * Math.PI) / 180) * radius;
    const oldX = wheelCenterX + Math.cos((oldAngle * Math.PI) / 180) * (radius - 16);
    const oldY = wheelCenterY + Math.sin((oldAngle * Math.PI) / 180) * (radius - 16);

    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Round Robin / TDMA View</p>
              <p className="mt-1 text-sm text-slate-500">Circular token ring and request map timing wheel.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-300">Token Wheel</div>
          </div>
        </div>
        <svg width="100%" height="360" viewBox={`0 0 ${schematicWidth} 360`} className="rounded-3xl bg-slate-950/80 p-4">
          {simulationDevices.map((device, index) => {
            const x = 120 + index * 120;
            const active = controlState.rrRequestMap[index];
            return (
              <g key={device.id}>
                <rect x={x - 28} y={100} width={56} height={36} rx={12} fill="#0f172a" stroke={active ? '#facc15' : '#334155'} strokeWidth={2} />
                <text x={x} y={123} textAnchor="middle" className="text-[12px] font-semibold fill-slate-100">{active ? 'Y' : 'N'}</text>
                <text x={x} y={143} textAnchor="middle" className="text-[10px] fill-slate-400">M{index + 1}</text>
              </g>
            );
          })}
          <circle cx={wheelCenterX} cy={wheelCenterY} r={radius} fill="#0f172a" stroke="#334155" strokeWidth={3} />
          {simulationDevices.map((device, index) => {
            const angle = (index * (360 / segments) - 90) * (Math.PI / 180);
            const x = wheelCenterX + Math.cos(angle) * (radius - 18);
            const y = wheelCenterY + Math.sin(angle) * (radius - 18);
            return (
              <g key={`${device.id}-wheel`}>
                <line x1={wheelCenterX} y1={wheelCenterY} x2={x} y2={y} stroke="#475569" strokeWidth={2} />
                <circle cx={x} cy={y} r={10} fill={controlState.rrRequestMap[index] ? '#facc15' : '#334155'} />
                <text x={x} y={y + 4} textAnchor="middle" className="text-[9px] fill-slate-950">{index + 1}</text>
              </g>
            );
          })}
          <line x1={wheelCenterX} y1={wheelCenterY} x2={pointerX} y2={pointerY} stroke="#38bdf8" strokeWidth={4} />
          <circle cx={pointerX} cy={pointerY} r={6} fill="#38bdf8" />
          <line x1={wheelCenterX} y1={wheelCenterY} x2={oldX} y2={oldY} stroke="#a855f7" strokeWidth={3} />
          <circle cx={oldX} cy={oldY} r={5} fill="#a855f7" />

          <text x={100} y={240} className="text-[12px] fill-slate-300">Old Pointer: {controlState.rrOldIndex !== null ? `Device ${controlState.rrOldIndex + 1}` : 'N/A'}</text>
          <text x={100} y={260} className="text-[12px] fill-slate-300">New Pointer: {controlState.rrNewIndex !== null ? `Device ${controlState.rrNewIndex + 1}` : 'Waiting'}</text>
          <text x={100} y={280} className="text-[12px] fill-slate-300">Next In Rotation Check: {controlState.rrNextCheckCycles ?? '-'} cycles</text>
        </svg>
      </div>
    );
  };

  const renderHardwareVisualizer = () => {
    switch (config.algorithm) {
      case 'Daisy Chain':
        return renderDaisyChainView();
      case 'Centralized Fixed Priority':
        return renderCentralizedFixedView();
      case 'Centralized Parallel':
        return renderCentralizedParallelView();
      case 'Round Robin':
        return renderRoundRobinView();
      default:
        return renderDaisyChainView();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1720px] px-5 py-6">
        <header className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/95 px-8 py-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Bus Arbitration Simulator</p>
              <h1 className="mt-3 text-4xl font-semibold text-white">Interactive System Bus Management Dashboard</h1>
              <p className="mt-2 max-w-2xl text-slate-400">Visualize request contention, signal arbitration, and dynamic performance metrics across multiple hardware devices.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-sm text-slate-400">Elapsed Cycles</p>
                <p className="mt-2 text-3xl font-semibold text-white">{simulationMetrics.elapsedCycles}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-sm text-slate-400">Throughput</p>
                <p className="mt-2 text-3xl font-semibold text-white">{simulationMetrics.throughput}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-sm text-slate-400">Bus Utilization</p>
                <p className="mt-2 text-3xl font-semibold text-cyan-300">{simulationMetrics.busUtilization}%</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-sm text-slate-400">Avg Waiting</p>
                <p className="mt-2 text-3xl font-semibold text-white">{simulationMetrics.averageWaitingTime}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="grid gap-6 xl:grid-cols-[390px_1fr]">
          <section className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-soft">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-white">Simulation Control & Configuration</h2>
              <p className="text-sm text-slate-400">Adjust algorithm, clock speed, device request probabilities, and run state.</p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                <p className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-400">Algorithm Selector</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {algorithmOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleAlgorithmChange(option)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${config.algorithm === option ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200' : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'}`}
                    >
                      <span className="block font-semibold">{option}</span>
                      <span className="mt-1 block text-xs text-slate-500">Live arbitration policy</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                <p className="mb-4 text-sm uppercase tracking-[0.2em] text-slate-400">Global Settings</p>
                <div className="space-y-4">
                  <label className="block text-sm text-slate-300">Clock Speed (ms / cycle)</label>
                  <input
                    type="range"
                    min={200}
                    max={1200}
                    value={config.clockInterval}
                    onChange={(event) => setConfig((current) => ({ ...current, clockInterval: Number(event.target.value) }))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex items-center justify-between text-sm text-slate-400"><span>{config.clockInterval} ms</span><span>Faster cycles increase update rate.</span></div>

                  <label className="block text-sm text-slate-300">Total Run Cycles</label>
                  <input
                    type="number"
                    min={50}
                    max={2000}
                    value={config.totalCycles}
                    onChange={(event) => setConfig((current) => ({ ...current, totalCycles: Number(event.target.value) }))}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                  />

                  <label className="block text-sm text-slate-300">Global Traffic Intensity</label>
                  <input
                    type="range"
                    min={0.4}
                    max={1.8}
                    step={0.05}
                    value={config.globalTraffic}
                    onChange={(event) => setConfig((current) => ({ ...current, globalTraffic: Number(event.target.value) }))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500"><span>{config.globalTraffic.toFixed(2)}×</span><span>Higher values increase request frequency.</span></div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Algorithm Weights</p>
                    <p className="text-xs text-slate-500">Used by Dynamic Priority formula.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-300">Alpha (Aging)</label>
                    <input
                      type="range"
                      min={0.1}
                      max={2}
                      step={0.05}
                      value={config.alpha}
                      onChange={(event) => setConfig((current) => ({ ...current, alpha: Number(event.target.value) }))}
                      className="w-full accent-cyan-400"
                    />
                    <div className="mt-1 text-xs text-slate-500">{config.alpha.toFixed(2)} aging multiplier</div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300">Beta (Request Frequency)</label>
                    <input
                      type="range"
                      min={0.1}
                      max={2}
                      step={0.05}
                      value={config.beta}
                      onChange={(event) => setConfig((current) => ({ ...current, beta: Number(event.target.value) }))}
                      className="w-full accent-cyan-400"
                    />
                    <div className="mt-1 text-xs text-slate-500">{config.beta.toFixed(2)} frequency penalty</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Device Tuner Table</p>
                  <p className="text-xs text-slate-500">Edit each device request rate, hold time, and priority.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">{deviceConfig.length} devices</span>
                </div>
              </div>
              <div className="space-y-3">
                {deviceConfig.map((device) => (
                  <div key={device.id} className="grid gap-3 rounded-3xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-[1.8fr_repeat(3,1fr)]">
                    <div>
                      <p className="font-semibold text-white">{device.name}</p>
                      <p className="text-xs text-slate-500">Base priority {device.basePriority}, hold {device.holdCycles} cycles</p>
                    </div>
                    <label className="space-y-2 text-xs text-slate-400">
                      Request Rate
                      <input
                        type="range"
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        value={device.requestRate}
                        onChange={(event) => handleDeviceField(device.id, 'requestRate', Number(event.target.value))}
                        className="w-full accent-cyan-400"
                      />
                      <div className="text-right text-sm text-slate-200">{(device.requestRate * 100).toFixed(0)}%</div>
                    </label>
                    <label className="space-y-2 text-xs text-slate-400">
                      Hold Cycles
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={device.holdCycles}
                        onChange={(event) => handleDeviceField(device.id, 'holdCycles', Number(event.target.value))}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                      />
                    </label>
                    <label className="space-y-2 text-xs text-slate-400">
                      Priority
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={device.basePriority}
                        onChange={(event) => handleDeviceField(device.id, 'basePriority', Number(event.target.value))}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-3xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                onClick={() => setRunning(true)}
              >
                <Play className="h-4 w-4" /> Start
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-3xl bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
                onClick={() => setRunning(false)}
              >
                <Pause className="h-4 w-4" /> Pause
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-3xl border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500"
                onClick={runCycle}
              >
                <SkipForward className="h-4 w-4" /> Step Forward
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-3xl bg-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-600"
                onClick={resetSimulation}
              >
                <RefreshCcw className="h-4 w-4" /> Reset
              </button>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-soft">
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Live Animation Stage</h2>
                  <p className="mt-2 text-sm text-slate-400">Observe device states and bus signal flow for the selected arbitration scheme.</p>
                </div>
                <div className="flex items-center gap-3 rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                  <Cpu className="h-4 w-4 text-cyan-300" /> {config.algorithm}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 px-6 py-8">
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-sm uppercase tracking-[0.25em] text-slate-400">System Bus Line</span>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                    {busOwnerId ? 'Active Transfer' : 'Idle'}
                  </span>
                </div>
                <div className="relative h-24 rounded-full bg-slate-800">
                  <div className={`absolute inset-y-0 left-0 w-full rounded-full transition-all ${busOwnerId ? 'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-400 animate-pulse' : 'bg-slate-700'}`} />
                  <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-950" />
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {simulationDevices.map((device, index) => {
                    const icon = device.id === 'cpu' ? <Cpu className="h-5 w-5" /> : device.id === 'memory' ? <Layers className="h-5 w-5" /> : device.id === 'disk' ? <HardDrive className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />;
                    const stateLabel = device.usingBus ? 'USING BUS' : device.requesting ? 'REQUESTING' : 'IDLE';
                    const stateColor = device.usingBus ? 'bg-cyan-500 text-slate-950' : device.requesting ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-100';
                    return (
                      <div key={device.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-soft min-h-[230px]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-white">{device.name}</p>
                            <p className="mt-1 text-sm uppercase tracking-[0.18em] text-slate-500">Priority {device.basePriority}</p>
                          </div>
                          <div className={`rounded-2xl px-4 py-1.5 text-sm font-semibold ${stateColor}`}>{stateLabel}</div>
                        </div>
                        <div className="mt-4 grid gap-2 text-sm text-slate-300">
                          <div className="flex items-center justify-between"><span>Waiting</span><span>{device.waitingTime}</span></div>
                          <div className="flex items-center justify-between"><span>Hold left</span><span>{device.holdRemaining}</span></div>
                          <div className="flex items-center justify-between"><span>Completed</span><span>{device.completedTransfers}</span></div>
                          <div className="flex items-center justify-between"><span>Starved</span><span>{device.starvationCount}</span></div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-slate-400">
                          {icon}
                          <span className="text-xs">#{index + 1} signal node</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8">{renderHardwareVisualizer()}</div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Analytical Performance Dashboard</h2>
                  <p className="mt-1 text-sm text-slate-400">Real-time metrics and fairness visualization by algorithm.</p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-300">Starvation Monitor</div>
              </div>

              <div className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                    <p className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-400">Bus Utilization</p>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={summary}>
                          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                          <XAxis dataKey="cycle" tick={{ fill: '#cbd5e1' }} />
                          <YAxis tick={{ fill: '#cbd5e1' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                          <Line type="monotone" dataKey="utilization" stroke="#38bdf8" strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                    <p className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-400">Throughput & Wait</p>
                    <div className="grid gap-4">
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={summary}>
                            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                            <XAxis dataKey="cycle" tick={{ fill: '#cbd5e1' }} />
                            <YAxis tick={{ fill: '#cbd5e1' }} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                            <Line type="monotone" dataKey="throughput" stroke="#22c55e" strokeWidth={3} dot={false} />
                            <Line type="monotone" dataKey="waitTime" stroke="#f97316" strokeWidth={3} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                  <p className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-400">Starvation Metric Monitor</p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={simulationDevices.map((device) => ({ name: device.name, starvation: device.starvationCount }))}>
                        <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fill: '#cbd5e1' }} />
                        <YAxis tick={{ fill: '#cbd5e1' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                        <Bar dataKey="starvation" fill="#f97316" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;

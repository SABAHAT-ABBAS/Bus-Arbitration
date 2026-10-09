import { ArbitrationAlgorithm, DeviceConfig, SimulationMetrics } from '../types';

const DEFAULT_ALPHA = 0.8;
const DEFAULT_BETA = 0.6;
const STARVATION_THRESHOLD = 12;

export interface SimulationConfig {
  algorithm: ArbitrationAlgorithm;
  globalTraffic: number;
  clockInterval: number;
  totalCycles: number;
  alpha: number;
  beta: number;
}

export const defaultDevices: DeviceConfig[] = [
  {
    id: 'cpu',
    name: 'CPU',
    basePriority: 5,
    requestRate: 0.45,
    holdCycles: 3,
    requesting: false,
    usingBus: false,
    waitingTime: 0,
    starvationCount: 0,
    completedTransfers: 0,
    holdRemaining: 0,
    requestHistory: [],
  },
  {
    id: 'dma',
    name: 'DMA Controller',
    basePriority: 3,
    requestRate: 0.2,
    holdCycles: 5,
    requesting: false,
    usingBus: false,
    waitingTime: 0,
    starvationCount: 0,
    completedTransfers: 0,
    holdRemaining: 0,
    requestHistory: [],
  },
  {
    id: 'memory',
    name: 'Memory Unit',
    basePriority: 4,
    requestRate: 0.28,
    holdCycles: 4,
    requesting: false,
    usingBus: false,
    waitingTime: 0,
    starvationCount: 0,
    completedTransfers: 0,
    holdRemaining: 0,
    requestHistory: [],
  },
  {
    id: 'disk',
    name: 'Disk Controller',
    basePriority: 2,
    requestRate: 0.18,
    holdCycles: 6,
    requesting: false,
    usingBus: false,
    waitingTime: 0,
    starvationCount: 0,
    completedTransfers: 0,
    holdRemaining: 0,
    requestHistory: [],
  },
  {
    id: 'printer',
    name: 'Peripheral Device',
    basePriority: 1,
    requestRate: 0.12,
    holdCycles: 7,
    requesting: false,
    usingBus: false,
    waitingTime: 0,
    starvationCount: 0,
    completedTransfers: 0,
    holdRemaining: 0,
    requestHistory: [],
  },
];

export class SimulationEngine {
  devices: DeviceConfig[];
  config: SimulationConfig;
  elapsedCycles: number;
  activeCycles: number;
  lastGrantIndex: number;
  busOwnerId: string | null;

  constructor(devices: DeviceConfig[], config: SimulationConfig) {
    this.devices = devices.map((device) => ({ ...device }));
    this.config = config;
    this.elapsedCycles = 0;
    this.activeCycles = 0;
    this.lastGrantIndex = -1;
    this.busOwnerId = null;
  }

  reset(devices: DeviceConfig[], config: SimulationConfig) {
    this.devices = devices.map((device) => ({ ...device, requesting: false, usingBus: false, waitingTime: 0, starvationCount: 0, completedTransfers: 0, holdRemaining: 0, requestHistory: [] }));
    this.config = config;
    this.elapsedCycles = 0;
    this.activeCycles = 0;
    this.lastGrantIndex = -1;
    this.busOwnerId = null;
  }

  step() {
    this.elapsedCycles += 1;
    const activeDevice = this.devices.find((device) => device.usingBus);

    if (activeDevice) {
      activeDevice.holdRemaining -= 1;
      this.activeCycles += 1;
      if (activeDevice.holdRemaining <= 0) {
        activeDevice.usingBus = false;
        this.busOwnerId = null;
      }
    }

    this.generateRequests();

    const requestStates = this.devices.map((device) => device.requesting && !device.usingBus);
    const requesters = this.devices.filter((device) => device.requesting && !device.usingBus);
    const brActive = requesters.length > 0;
    let bgActive = false;
    let bbsyActive = Boolean(this.busOwnerId || activeDevice);
    let bgReachIndex = -1;
    let bgInterceptIndex: number | null = null;
    let bgGrantDeviceId: string | null = null;
    let fixedPriorityGrantIndex: number | null = null;
    let parallelDecoderActiveIndex: number | null = null;
    let parallelEncoderBits: [number, number] = [0, 0];
    let rrOldIndex: number | null = null;
    let rrNewIndex: number | null = null;
    let rrNextCheckCycles: number | null = null;

    if (this.busOwnerId) {
      rrOldIndex = this.devices.findIndex((device) => device.id === this.busOwnerId);
    } else if (this.lastGrantIndex >= 0) {
      rrOldIndex = this.lastGrantIndex;
    }

    if (requesters.length) {
      const selected = this.arbitrate(requesters);
      const selectedIndex = selected ? this.devices.findIndex((device) => device.id === selected.id) : -1;

      if (this.config.algorithm === 'Daisy Chain') {
        for (let index = 0; index < this.devices.length; index += 1) {
          const device = this.devices[index];
          if (device.requesting && !device.usingBus) {
            bgReachIndex = index;
            bgInterceptIndex = index;
            bgGrantDeviceId = device.id;
            break;
          }
          bgReachIndex = index;
        }
      } else if (this.config.algorithm === 'Centralized Fixed Priority') {
        fixedPriorityGrantIndex = selectedIndex >= 0 ? selectedIndex : null;
      } else if (this.config.algorithm === 'Centralized Parallel') {
        parallelDecoderActiveIndex = selectedIndex >= 0 ? selectedIndex : null;
        if (selectedIndex >= 0) {
          parallelEncoderBits = [selectedIndex >> 1, selectedIndex & 1];
        }
      } else if (this.config.algorithm === 'Round Robin') {
        rrNewIndex = selectedIndex >= 0 ? selectedIndex : null;
        if (rrOldIndex !== null && rrNewIndex !== null) {
          const total = this.devices.length;
          rrNextCheckCycles = (rrNewIndex - rrOldIndex + total) % total || total;
        } else if (rrNewIndex !== null) {
          rrNextCheckCycles = rrNewIndex + 1;
        }
      }

      if (selected) {
        if (this.config.algorithm === 'Daisy Chain') {
          bgActive = bgReachIndex >= 0;
        } else if (this.config.algorithm === 'Centralized Fixed Priority') {
          bgActive = fixedPriorityGrantIndex !== null;
          bgInterceptIndex = fixedPriorityGrantIndex;
          bgGrantDeviceId = selected.id;
        } else if (this.config.algorithm === 'Centralized Parallel') {
          bgActive = parallelDecoderActiveIndex !== null;
          bgInterceptIndex = parallelDecoderActiveIndex;
          bgGrantDeviceId = selected.id;
        } else if (this.config.algorithm === 'Round Robin') {
          bgActive = rrNewIndex !== null;
          bgInterceptIndex = rrNewIndex;
          bgGrantDeviceId = selected.id;
        }

        selected.usingBus = true;
        selected.requesting = false;
        selected.holdRemaining = selected.holdCycles;
        selected.completedTransfers += 1;
        selected.waitingTime = 0;
        this.busOwnerId = selected.id;
        bbsyActive = true;
        this.activeCycles += 1;
        this.lastGrantIndex = selectedIndex;
      }
    }

    this.updateWaitingAndStarvation();

    const metrics = this.computeMetrics();
    return {
      devices: this.devices,
      busOwnerId: this.busOwnerId,
      metrics,
      controlState: {
        brActive,
        bgActive,
        bbsyActive,
        bgReachIndex,
        bgInterceptIndex,
        bgGrantDeviceId,
        bbsyOwnerId: this.busOwnerId,
        fixedPriorityRequestStates: requestStates,
        fixedPriorityGrantIndex,
        parallelRequestStates: requestStates,
        parallelEncoderBits,
        parallelDecoderActiveIndex,
        rrRequestMap: requestStates,
        rrOldIndex,
        rrNewIndex,
        rrNextCheckCycles,
      },
    };
  }

  generateRequests() {
    const intensity = this.config.globalTraffic;
    this.devices.forEach((device) => {
      if (device.usingBus || device.requesting) {
        device.requestHistory.push(device.requesting ? 1 : 0);
        if (device.requestHistory.length > 20) device.requestHistory.shift();
        return;
      }
      const effectiveRate = Math.min(0.98, device.requestRate * intensity);
      const requested = Math.random() < effectiveRate;
      device.requesting = requested;
      if (requested) {
        device.requestHistory.push(1);
      } else {
        device.requestHistory.push(0);
      }
      if (device.requestHistory.length > 20) device.requestHistory.shift();
    });
  }

  arbitrationScore(device: DeviceConfig) {
    const waitingMultiplier = this.config.alpha * device.waitingTime;
    const frequency = device.requestHistory.length ? device.requestHistory.reduce((sum, value) => sum + value, 0) / device.requestHistory.length : 0;
    return device.basePriority + waitingMultiplier - this.config.beta * frequency;
  }

  computeRequestFrequency(device: DeviceConfig) {
    if (!device.requestHistory.length) return 0;
    return device.requestHistory.reduce((sum, value) => sum + value, 0) / device.requestHistory.length;
  }

  arbitrate(requesters: DeviceConfig[]) {
    switch (this.config.algorithm) {
      case 'Daisy Chain':
        return requesters[0];
      case 'Round Robin':
        return this.selectRoundRobin(requesters);
      case 'Centralized Fixed Priority':
        return this.selectFixedPriority(requesters);
      case 'Centralized Parallel':
        return this.selectCentralizedParallel(requesters);
      case 'Dynamic Priority':
        return this.selectDynamicPriority(requesters);
      default:
        return requesters[0];
    }
  }

  selectRoundRobin(requesters: DeviceConfig[]) {
    const baseIndex = (this.lastGrantIndex + 1) % this.devices.length;
    for (let offset = 0; offset < this.devices.length; offset += 1) {
      const index = (baseIndex + offset) % this.devices.length;
      const candidate = this.devices[index];
      if (candidate.requesting && requesters.includes(candidate)) {
        return candidate;
      }
    }
    return requesters[0];
  }

  selectCentralizedParallel(requesters: DeviceConfig[]) {
    return [...requesters].sort((a, b) => {
      if (a.basePriority !== b.basePriority) return b.basePriority - a.basePriority;
      if (a.waitingTime !== b.waitingTime) return b.waitingTime - a.waitingTime;
      return b.holdCycles - a.holdCycles;
    })[0];
  }

  selectFixedPriority(requesters: DeviceConfig[]) {
    return [...requesters].sort((a, b) => {
      if (a.basePriority !== b.basePriority) return b.basePriority - a.basePriority;
      return a.requestHistory.length - b.requestHistory.length;
    })[0];
  }

  selectDynamicPriority(requesters: DeviceConfig[]) {
    return [...requesters].sort((a, b) => {
      const aScore = this.arbitrationScore(a);
      const bScore = this.arbitrationScore(b);
      if (aScore !== bScore) return bScore - aScore;
      return b.basePriority - a.basePriority;
    })[0];
  }

  updateWaitingAndStarvation() {
    this.devices.forEach((device) => {
      if (device.requesting && !device.usingBus) {
        device.waitingTime += 1;
        if (device.waitingTime >= STARVATION_THRESHOLD) {
          device.starvationCount += 1;
        }
      }
    });
  }

  computeMetrics(): SimulationMetrics {
    const totalWaiting = this.devices.reduce((sum, device) => sum + device.waitingTime, 0);
    const averageWaitingTime = this.devices.length ? totalWaiting / this.devices.length : 0;
    const throughput = this.elapsedCycles ? this.devices.reduce((sum, device) => sum + device.completedTransfers, 0) / this.elapsedCycles : 0;
    const utilization = this.elapsedCycles ? (this.activeCycles / this.elapsedCycles) * 100 : 0;

    return {
      elapsedCycles: this.elapsedCycles,
      activeCycles: this.activeCycles,
      busUtilization: Number(utilization.toFixed(1)),
      throughput: Number(throughput.toFixed(2)),
      averageWaitingTime: Number(averageWaitingTime.toFixed(2)),
    };
  }
}

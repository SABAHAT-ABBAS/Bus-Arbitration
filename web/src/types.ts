export type ArbitrationAlgorithm =
  | 'Daisy Chain'
  | 'Round Robin'
  | 'Centralized Fixed Priority'
  | 'Centralized Parallel'
  | 'Dynamic Priority';

export interface DeviceConfig {
  id: string;
  name: string;
  basePriority: number;
  requestRate: number;
  holdCycles: number;
  requesting: boolean;
  usingBus: boolean;
  waitingTime: number;
  starvationCount: number;
  completedTransfers: number;
  holdRemaining: number;
  requestHistory: number[];
}

export interface SimulationMetrics {
  elapsedCycles: number;
  activeCycles: number;
  busUtilization: number;
  throughput: number;
  averageWaitingTime: number;
}

export interface ControlSignalState {
  brActive: boolean;
  bgActive: boolean;
  bbsyActive: boolean;
  bgReachIndex: number;
  bgInterceptIndex: number | null;
  bgGrantDeviceId: string | null;
  bbsyOwnerId: string | null;
  fixedPriorityRequestStates: boolean[];
  fixedPriorityGrantIndex: number | null;
  parallelRequestStates: boolean[];
  parallelEncoderBits: [number, number];
  parallelDecoderActiveIndex: number | null;
  rrRequestMap: boolean[];
  rrOldIndex: number | null;
  rrNewIndex: number | null;
  rrNextCheckCycles: number | null;
}

export interface SimulationSnapshot {
  devices: DeviceConfig[];
  metrics: SimulationMetrics;
  busOwnerId: string | null;
  algorithm: ArbitrationAlgorithm;
  controlState: ControlSignalState;
}

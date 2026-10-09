import random
import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional

DEFAULT_ALGORITHMS = [
    "Daisy Chain",
    "Round Robin",
    "Centralized Parallel",
    "Centralized Fixed Priority",
    "Dynamic Priority",
]


class Device:
    def __init__(
        self,
        name: str,
        base_priority: int,
        hold_cycles: int = 3,
        request_rate: float = 0.25,
    ):
        self.name: str = name
        self.priority: int = base_priority
        self.base_request_rate: float = request_rate
        self.hold_cycles: int = hold_cycles

        self.requesting: bool = False
        self.using_bus: bool = False
        self.waiting_time: int = 0
        self.hold_remaining: int = 0
        self.total_requests: int = 0
        self.completed_requests: int = 0
        self.starvation_count: int = 0
        self.historical_grants: int = 0
        self.dynamic_priority: float = float(base_priority)

    def generate_request(self, traffic_intensity: float = 1.0) -> None:
        if self.using_bus:
            return

        if not self.requesting:
            effective_rate = min(0.95, self.base_request_rate * traffic_intensity)
            if random.random() < effective_rate:
                self.requesting = True
                self.waiting_time = 0
                self.total_requests += 1
        else:
            self.waiting_time += 1
            if self.waiting_time > 12:
                self.starvation_count += 1

    def reset(self) -> None:
        self.requesting = False
        self.using_bus = False
        self.waiting_time = 0
        self.hold_remaining = 0
        self.total_requests = 0
        self.completed_requests = 0
        self.starvation_count = 0
        self.historical_grants = 0
        self.dynamic_priority = float(self.priority)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "Device": self.name,
            "Requests": self.total_requests,
            "Completed": self.completed_requests,
            "Waiting Time": self.waiting_time,
            "Starvation": self.starvation_count,
        }


class BusArbitrationModel:
    def __init__(self):
        self.current_algorithm: str = "Round Robin"
        self.alpha: float = 0.8
        self.beta: float = 0.6
        self.traffic_intensity: float = 1.0

        self.devices: List[Device] = [
            Device("CPU", base_priority=5, hold_cycles=2, request_rate=0.30),
            Device("DMA", base_priority=4, hold_cycles=3, request_rate=0.25),
            Device("Memory", base_priority=3, hold_cycles=4, request_rate=0.20),
            Device("Disk", base_priority=2, hold_cycles=6, request_rate=0.15),
            Device("Printer", base_priority=1, hold_cycles=5, request_rate=0.10),
        ]

        self.round_robin_index: int = 0
        self.clock_cycle: int = 0
        self.total_completed: int = 0
        self.bus_busy_cycles: int = 0

        self.waiting_times: List[float] = []
        self.throughput_history: List[float] = []
        self.utilization_history: List[float] = []

    def configure_simulation(
        self,
        algorithm: str,
        alpha: float = 0.8,
        beta: float = 0.6,
        traffic_intensity: float = 1.0,
    ) -> None:
        if algorithm in DEFAULT_ALGORITHMS:
            self.current_algorithm = algorithm
        self.alpha = alpha
        self.beta = beta
        self.traffic_intensity = traffic_intensity

    def reset(self) -> None:
        self.clock_cycle = 0
        self.total_completed = 0
        self.bus_busy_cycles = 0
        self.round_robin_index = 0
        self.waiting_times.clear()
        self.throughput_history.clear()
        self.utilization_history.clear()
        for device in self.devices:
            device.reset()

    def step(self) -> Dict[str, Any]:
        self.clock_cycle += 1

        active_owner = next((d for d in self.devices if d.using_bus), None)
        if active_owner:
            self.bus_busy_cycles += 1
            active_owner.hold_remaining -= 1
            if active_owner.hold_remaining <= 0:
                active_owner.using_bus = False
                active_owner.completed_requests += 1
                self.total_completed += 1
                active_owner = None

        for device in self.devices:
            device.generate_request(self.traffic_intensity)

        granted_index: Optional[int] = None
        if active_owner is None:
            granted_index = self.perform_arbitration()
            if granted_index is not None:
                granted_device = self.devices[granted_index]
                granted_device.requesting = False
                granted_device.using_bus = True
                granted_device.hold_remaining = granted_device.hold_cycles
                granted_device.historical_grants += 1
                if self.current_algorithm == "Round Robin":
                    self.round_robin_index = (granted_index + 1) % len(self.devices)
                active_owner = granted_device

        for device in self.devices:
            if device.requesting and device is not active_owner:
                device.waiting_time += 1
                if device.waiting_time > 10:
                    device.starvation_count += 1

        avg_wait = float(np.mean([d.waiting_time for d in self.devices]))
        throughput = self.total_completed / max(1, self.clock_cycle)
        utilization = (self.bus_busy_cycles / max(1, self.clock_cycle)) * 100.0

        self.waiting_times.append(avg_wait)
        self.throughput_history.append(throughput)
        self.utilization_history.append(utilization)

        return {
            "bus_owner": active_owner.name if active_owner else None,
            "control_signals": self._generate_control_signals(granted_index),
            "metrics": {
                "clock_cycle": self.clock_cycle,
                "average_wait": round(avg_wait, 2),
                "throughput": round(throughput, 3),
                "utilization": round(utilization, 2),
            },
        }

    def perform_arbitration(self) -> Optional[int]:
        requesting_indices = [
            i for i, d in enumerate(self.devices) if d.requesting and not d.using_bus
        ]
        if not requesting_indices:
            return None

        if self.current_algorithm == "Daisy Chain":
            return requesting_indices[0]

        if self.current_algorithm in ["Centralized Parallel", "Centralized Fixed Priority"]:
            return max(requesting_indices, key=lambda i: self.devices[i].priority)

        if self.current_algorithm == "Round Robin":
            for offset in range(len(self.devices)):
                index = (self.round_robin_index + offset) % len(self.devices)
                if index in requesting_indices:
                    return index

        if self.current_algorithm == "Dynamic Priority":
            best_index = requesting_indices[0]
            best_score = -float("inf")
            for index in requesting_indices:
                device = self.devices[index]
                device.dynamic_priority = (
                    device.priority + self.alpha * device.waiting_time - self.beta * device.historical_grants
                )
                if device.dynamic_priority > best_score:
                    best_score = device.dynamic_priority
                    best_index = index
            return best_index

        return None

    def _generate_control_signals(self, granted_index: Optional[int]) -> Dict[str, Any]:
        br_active = any(d.requesting for d in self.devices)
        bg_active = granted_index is not None
        bbsy_active = any(d.using_bus for d in self.devices)
        encoder_bits = [0, 0]
        if granted_index is not None:
            encoder_bits = [(granted_index >> 1) & 1, granted_index & 1]

        return {
            "brActive": br_active,
            "bgActive": bg_active,
            "bbsyActive": bbsy_active,
            "bgReachIndex": granted_index if granted_index is not None else -1,
            "parallelEncoderBits": encoder_bits,
            "rrNewIndex": self.round_robin_index,
        }

    def get_report_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame([device.to_dict() for device in self.devices])

    def get_device_states(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": device.name,
                "requesting": device.requesting,
                "using_bus": device.using_bus,
                "waiting_time": device.waiting_time,
                "priority": device.priority,
                "hold_remaining": device.hold_remaining,
                "completed_requests": device.completed_requests,
                "starvation_count": device.starvation_count,
                "dynamic_priority": device.dynamic_priority,
            }
            for device in self.devices
        ]

    def get_metrics(self) -> Dict[str, Any]:
        return {
            "clock_cycle": self.clock_cycle,
            "average_wait": self.waiting_times[-1] if self.waiting_times else 0,
            "throughput": self.throughput_history[-1] if self.throughput_history else 0,
            "utilization": self.utilization_history[-1] if self.utilization_history else 0,
        }
